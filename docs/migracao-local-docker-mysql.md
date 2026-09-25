# Migração da FK Madeiras para execução local com Docker e MySQL

## 1. Resumo da situação atual

O projeto já utiliza `DATABASE_URL` para conectar ao MySQL/TiDB e o servidor escuta a porta definida por `PORT`, usando `3000` como padrão. O build atual gera os arquivos React em `dist/public` e o servidor compilado em `dist/index.js`.

A autenticação própria já está parcialmente implementada no projeto. Existem login por e-mail e senha, sessão assinada no cookie `fk_sessao_local`, convites de colaboradores, criação de senha, hash com `scrypt`, bloqueio após tentativas falhas e recuperação associada às tabelas de identidade. Atualmente, o contexto tenta primeiro a sessão local e depois ainda permite autenticação Manus como fallback.

Portanto, a migração não deve começar criando outro sistema de login. O caminho seguro é terminar a desativação do fallback Manus depois de validar a autenticação local.

## 2. Execução local com Docker e MySQL

O projeto já inclui `docker-compose.local.yml`, `docker/local/Dockerfile` e `.env.docker.example`. Esses arquivos são exclusivos da execução local e não substituem o deploy gerido do Manus. Prepare as variáveis assim:
```bash
cp .env.docker.example .env.docker
openssl rand -base64 48
```
Substitua as senhas e o `JWT_SECRET` em `.env.docker`. Nunca versione esse arquivo. Dentro da rede do Compose, o host do banco é `mysql`, não `localhost`; a porta `3307` serve apenas para acesso a partir da máquina hospedeira.

Valide a configuração antes de iniciar:
```bash
docker compose --env-file .env.docker -f docker-compose.local.yml config
```



Suba apenas o MySQL primeiro:
```bash
docker compose --env-file .env.docker -f docker-compose.local.yml up -d mysql
docker compose --env-file .env.docker -f docker-compose.local.yml ps
docker compose --env-file .env.docker -f docker-compose.local.yml logs -f mysql
```

Depois, construa a aplicação e aplique as migrations já existentes:
```bash
docker compose --env-file .env.docker -f docker-compose.local.yml build app
docker compose --env-file .env.docker -f docker-compose.local.yml run --rm app pnpm drizzle-kit migrate
docker compose --env-file .env.docker -f docker-compose.local.yml up -d app
```

Acesse `http://localhost:3000`. Para acompanhar os logs:
```bash
docker compose --env-file .env.docker -f docker-compose.local.yml logs -f app
```

O comando `pnpm drizzle-kit migrate` deve ser utilizado somente quando o banco estiver numa situação conhecida. Não execute `drizzle-kit generate` em produção ou num banco migrado sem revisar o SQL gerado.

### 2.1 Teste reprodutível das migrations em banco vazio

O projeto também inclui `docker-compose.migrations-test.yml` e `scripts/test-migrations-docker.sh`. Esse ambiente usa outro container, outra base, outra porta (`3308`) e `tmpfs`, portanto não acessa nem remove o container `fk-madeiras-mysql` ou o volume `fk_madeiras_mysql`.

No WSL ou num terminal Bash, execute:

```bash
./scripts/test-migrations-docker.sh
```

No PowerShell, o mesmo teste pode ser executado diretamente:

```powershell
docker compose -f docker-compose.migrations-test.yml up --build --abort-on-container-exit --exit-code-from migration-test
docker compose -f docker-compose.migrations-test.yml down --remove-orphans
```

O resultado esperado é a conclusão de `pnpm drizzle-kit migrate` sem erro no serviço `migration-test`. O teste não deve usar `docker compose down -v` sobre o Compose local, pois isso poderia remover volumes do ambiente de homologação. O arquivo `drizzle/meta/_journal.json` deve conter exatamente uma entrada para cada um dos 73 arquivos SQL, e a cadeia corrigida não deve exigir que uma base seja previamente preparada pelo Manus.

A auditoria realizada encontrou duplicidades de DDL em `0010`, `0015`, `0019`, `0022`, `0049`, `0063` e `0067`. Elas foram removidas preservando a numeração, o journal, a ordem das alterações, os backfills e as constraints funcionais. O schema TypeScript continuou sem diferenças detectadas pelo `drizzle-kit generate`.

## 3. Substituição completa do Manus pelo login próprio

### 3.1 O que já existe

O projeto já contém:

| Recurso | Localização | Situação |
|---|---|---|
| Hash seguro de senha com `scrypt` | `server/autenticacao-local.ts` | Implementado |
| Sessão assinada no cookie | `server/autenticacao-local.ts` | Implementado |
| Login por e-mail e senha | `server/routers.ts`, procedimento `auth.entrar` | Implementado |
| Convite de colaborador | `server/routers.ts` | Implementado |
| Aceitação de convite e criação de senha | `server/routers.ts` | Implementado |
| Leitura da sessão local no contexto tRPC | `server/_core/context.ts` | Implementado |
| Fallback para OAuth Manus | `server/_core/context.ts` | Ainda ativo |
| Callback OAuth Manus | `server/_core/oauth.ts` | Ainda registado |
| Redirecionamento automático para login Manus | `client/src/const.ts` e `client/src/_core/hooks/useAuth.ts` | Ainda presente |

### 3.2 Ordem segura da alteração

Primeiro configure `JWT_SECRET` com pelo menos 32 caracteres e teste `/login`, `/cadastro` e `/convite/:token` em ambiente local. Não remova o OAuth antes de confirmar que o administrador consegue entrar com senha e que um colaborador convidado consegue aceitar o convite.

Depois altere `server/_core/context.ts`. O trecho que hoje faz fallback para o SDK Manus deve passar a aceitar somente a sessão local:

```ts
try {
  const sessao = lerSessaoLocal(
    lerCookie(opts.req.headers.cookie, COOKIE_SESSAO_LOCAL),
  );
  if (sessao) user = (await getUserById(sessao.usuarioId)) ?? null;
} catch {
  user = null;
}
```

Remova o `sdk.authenticateRequest` e a importação do `sdk` desse arquivo. O restante do contexto — `req`, `res`, `user` e `configuracaoEmpresa` — deve permanecer igual.

Em `server/_core/index.ts`, remova ou condicione a chamada:

```ts
registerOAuthRoutes(app);
```

A rota `/api/oauth/callback` deixa de ser necessária quando o OAuth Manus estiver desativado. O arquivo `server/_core/oauth.ts` pode permanecer durante a fase de transição, mas não deve ser registado nem utilizado.

No frontend, troque o comportamento de `startLogin()` para redirecionar para `/login` em vez de construir uma URL com `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID` e `/api/oauth/callback`. O hook `useAuth` deve continuar chamando `trpc.auth.me`; quando não houver utilizador, deve navegar para `/login`.

Após essa alteração, remova apenas as variáveis Manus que já não tiverem referências no código:

```text
VITE_OAUTH_PORTAL_URL
VITE_APP_ID
OAUTH_SERVER_URL
OWNER_OPEN_ID, se não for mais utilizado por outro fluxo
```

Antes de removê-las, execute uma pesquisa global:

```bash
grep -RIn --exclude-dir=node_modules --exclude-dir=.git \
  -E 'VITE_OAUTH_PORTAL_URL|VITE_APP_ID|OAUTH_SERVER_URL|authenticateRequest|registerOAuthRoutes|startLogin' \
  server client drizzle
```

### 3.3 Utilizadores já existentes

Não copie tokens OAuth para o sistema local e não tente converter uma senha Manus, pois a aplicação não conhece essa senha. Preserve os IDs, papéis, empresa e histórico dos utilizadores. Para cada utilizador existente que precise continuar acessando:

1. confirme que o e-mail está preenchido;
2. crie ou envie um convite local para esse e-mail;
3. peça ao utilizador para definir uma senha com pelo menos 8 caracteres, uma letra maiúscula e um número;
4. valide o acesso local;
5. somente depois desative o fallback Manus.

Se for necessário manter o mesmo registro de utilizador, a transição deve gravar uma linha em `credenciaisUsuarios` associada ao `users.id`, sem criar outro utilizador para a mesma pessoa. Não altere manualmente senhas com SQL sem gerar o hash pelo mesmo algoritmo usado em `gerarHashSenha`.

### 3.4 Proteções que devem permanecer

O login próprio deve manter a mensagem genérica para credenciais inválidas, o bloqueio temporário após várias tentativas, o cookie `HttpOnly`, `SameSite` e `Secure` em produção, a expiração da sessão e a validação de papel operacional. Nunca armazene senha em texto puro e nunca coloque `JWT_SECRET` no código do frontend.

## 4. Dump da base de dados atual

O dump deve ser executado numa máquina que consiga acessar a base atual. A senha deve ser solicitada pelo parâmetro `-p`, sem ser escrita no comando.

Primeiro identifique os componentes de `DATABASE_URL` — host, porta, utilizador, base e eventual exigência de SSL. Depois execute:

```bash
mysqldump \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --hex-blob \
  --set-gtid-purged=OFF \
  -h HOST_ATUAL \
  -P PORTA_ATUAL \
  -u UTILIZADOR_ATUAL \
  -p \
  NOME_DA_BASE > fk-madeiras-$(date +%Y%m%d-%H%M%S).sql
```

Se o provedor exigir TLS, acrescente a opção apropriada, normalmente:

```bash
--ssl-mode=REQUIRED
```

Não inclua a senha na URL ou no comando se o terminal for partilhado. Proteja o arquivo:

```bash
chmod 600 fk-madeiras-*.sql
sha256sum fk-madeiras-*.sql > fk-madeiras-*.sha256
```

Se a base for TiDB ou um serviço MySQL compatível e o dump apresentar incompatibilidade com estatísticas de coluna, tente acrescentar:

```bash
--column-statistics=0
```

Depois valide o arquivo sem restaurá-lo:

```bash
head -n 30 fk-madeiras-YYYYMMDD-HHMMSS.sql
grep -E '^CREATE TABLE|^INSERT INTO' fk-madeiras-YYYYMMDD-HHMMSS.sql | head
```

O dump MySQL contém tabelas, dados, índices, triggers, eventos e procedimentos conforme as opções usadas. Não contém automaticamente arquivos anexados que estejam num armazenamento S3 ou semelhante, nem segredos, certificados, cookies de sessão ou configurações de ambiente.

## 5. Restauração no MySQL Docker

Pare a aplicação antes de restaurar para evitar escritas durante o processo:

```bash
docker compose stop app
```

Faça um backup do banco Docker, caso ele já contenha dados:

```bash
docker compose exec -T mysql mysqldump \
  -u root -p \
  --single-transaction --routines --triggers --events \
  fkmadeiras > fk-madeiras-local-antes-da-restauracao.sql
```

Restaure o dump no banco local:

```bash
cat fk-madeiras-YYYYMMDD-HHMMSS.sql | \
  docker compose exec -T mysql mysql \
  -u root -p fkmadeiras
```

Em alternativa, utilizando o utilizador da aplicação:

```bash
cat fk-madeiras-YYYYMMDD-HHMMSS.sql | \
  docker compose exec -T mysql mysql \
  -u fk_madeiras -p fkmadeiras
```

Depois valide as tabelas e algumas contagens críticas:

```bash
docker compose exec mysql mysql -u root -p -e \
  "USE fkmadeiras; SHOW TABLES; SELECT COUNT(*) AS usuarios FROM users; SELECT COUNT(*) AS vendas FROM orcamentos; SELECT COUNT(*) AS titulos FROM titulos_financeiros;"
```

Os nomes exatos das tabelas devem ser confirmados no dump e no `drizzle/schema.ts`, pois uma tabela pode ter nome diferente do nome do modelo TypeScript.

Só depois inicie novamente a aplicação:

```bash
docker compose up -d app
docker compose logs -f app
```

Valide, no mínimo, login, utilizadores, fornecedores, clientes, estoque, produção, vendas, contas a pagar, contas a receber, conciliação e Rentabilidade da Madeira. Faça também uma comparação de saldos antes e depois da migração.

## 6. Anexos e demais dados fora do MySQL

O banco não é necessariamente a fonte dos bytes dos anexos de notas fiscais, boletos e documentos. Se esses arquivos estiverem em S3 ou armazenamento compatível, faça uma migração separada, preservando as chaves e URLs ou alterando-as para um bucket próprio. Também migre os segredos de produção de forma segura; não os coloque no dump nem no Git.

## 7. Ordem recomendada para produção

A sequência com menor risco é:

1. criar uma cópia do repositório;
2. provisionar MySQL Docker vazio;
3. restaurar o dump numa base de homologação;
4. configurar `DATABASE_URL` e `JWT_SECRET` locais;
5. validar o login próprio já existente;
6. migrar ou convidar os utilizadores atuais;
7. remover o fallback OAuth Manus;
8. executar testes e validações dos módulos;
9. migrar anexos e demais integrações;
10. fazer um novo dump da homologação validada;
11. restaurar na base definitiva;
12. só então apontar os computadores dos funcionários para a nova aplicação.

O principal risco é desligar o Manus antes de todos os utilizadores possuírem credenciais locais. O segundo é restaurar uma base sem validar anexos, sessões, saldos financeiros e referências de armazenamento.

## Referências

[1]: https://docs.docker.com/compose/ Docker Compose Documentation
[2]: https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html MySQL 8.4 Reference Manual — `mysqldump`
[3]: https://orm.drizzle.team/docs/kit-overview Drizzle Kit Documentation
