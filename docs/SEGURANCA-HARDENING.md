# FK Madeiras — evidências da rodada de hardening

Data: 28/09/2026. Escopo: código local, dependências e testes. React/Vite, Express/tRPC, Drizzle/MySQL e autenticação local preservados. A aplicação é **monoempresa**: `users` tem perfil operacional direto, sem vínculo de tenant por usuário; `getEmpresaUnica()` exige exatamente uma empresa ativa. Os filtros usam essa configuração do servidor, nunca uma empresa enviada pelo cliente. Este PR não transforma o sistema em SaaS multiempresa.

## 1. Arquivos alterados

A lista completa e individual está em [SEGURANCA-ARQUIVOS.md](SEGURANCA-ARQUIVOS.md), incluindo testes, relatórios e evidências.

## 2. Vulnerabilidades/fragilidades corrigidas

| Problema original e risco | Correção e impedimento de exploração | Evidência |
|---|---|---|
| Storage assinava qualquer chave sem sessão: leitura indevida de anexos | Sessão server-side; perfil; consulta por chave persistida + empresa; título também limitado por empresa; mesma política do módulo. Sem sessão 401, perfil sem acesso 403, chave ausente/externa 404. Só depois assina. Logotipo também exige registro da empresa. URLs legadas continuam válidas quando vinculadas. | `storageProxy.test.ts` |
| Recorrências, vendas, romaneios, baixas, itens de RH e outros acessos apenas por ID, inclusive escrita após leitura protegida | Predicados `id/parentId + empresaId` em leitura/update/delete e empresa nos JOINs; rotinas agendadas de recorrências/alertas limitadas à empresa operacional. Categoria automática de diesel grava empresa. Convites limitados à empresa ativa. | `security-boundaries.test.ts`, testes operacionais e inventário SQL |
| IDs relacionados podiam apontar a registros externos | Middleware de mutações protegidas valida referências explícitas a clientes, fornecedores, RH, contas, títulos, estoque, produtos e categorias por empresa, antes da persistência; consultas usam filtros próprios. | Teste de cliente externo, SQL parametrizado e testes dos routers |
| Login sem limite por IP e com bloqueio persistente de conta após falhas | Até 120 operações de login/aceitação de convite por IP em 15 minutos; HTTP 429 e Retry-After; batches contam cada operação; IPv6 agregado por /64. Tentativas inválidas recebem backoff progressivo por e-mail normalizado, limitado a 2 segundos; e-mails inexistentes executam `scrypt` com hash sintético. Falhas de contas existentes são contabilizadas persistentemente, com atualização SQL atômica e janela de inatividade de 15 minutos, mas não bloqueiam a conta. Uma senha correta continua sendo verificada e aceita após falhas anteriores; login bem-sucedido limpa o contador e o backoff. Rate limiter e backoff são locais ao processo, limitados em memória a 10.000 entradas, e não oferecem limite global contra tentativas distribuídas ou várias instâncias. | `loginRateLimit.test.ts`, `loginCredentialBackoff.test.ts`, `auth.login.test.ts`, `login-account.security.test.ts` |
| Persistência ampla podia aceitar campos novos privilegiados futuramente | Whitelists explícitas nas atualizações de recorrências, cadastros, contas, produtos e campos de RH; Zod continua descartando campos extras; empresa/criador vêm do servidor. | Tentativas com empresaId, criadoPor, id e papel em `security-boundaries.test.ts` |
| APIs retornavam identificadores internos de autenticação e dados pessoais desnecessários | Projeções de usuário público/equipe; resumo RH sem CPF/RG/PIS/dados bancários; listagem de anexos sem storageKey/criador/empresa. Cadastro RH completo mantido para edição autorizada. | Typecheck, testes de UI e de projeção |
| Upload gravava objeto antes de verificar título | Confirma título antes do storage; preserva allowlist, magic bytes, nome seguro e tamanho de 8 MiB. Logos mantêm 2 MiB. | `uploads.security.test.ts`, `empresa.test.ts` |
| Parser aceitava 50 MiB por requisição | JSON/form limitados a 16 MiB: maior anexo legítimo 8 MiB vira 11.184.812 caracteres base64, dentro do schema de 12 milhões, mais metadata. Logo 2 MiB e CSVs de 1 milhão de caracteres cabem. Sem necessidade encontrada para 50 MiB; batches também respeitam teto agregado. | Código dos uploads e do parser |
| IDs sem integralidade/positividade, textos/arrays sem teto e datas normalizadas silenciosamente | Limites nas entradas existentes, arrays antes ilimitados até 2.000 itens, limites de texto, IDs positivos e calendário real para schemas de data; números infinitos rejeitados nos decimais de produção. | Testes dos schemas, typecheck e teste de calendário |
| Cookie interpretava X-Forwarded-Proto diretamente | Usa `req.protocol` calculado pelo Express; trust proxy limitado a loopback por padrão ou IPs/CIDRs explícitos em TRUSTED_PROXY_CIDRS. Secure continua obrigatório em produção. | `cookies.test.ts` |
| Erros de storage/OAuth podiam registrar resposta/objeto com detalhes internos | Respostas de storage genéricas; não inclui corpo do backend nas exceções; logs de falhas OAuth sem objeto do erro. | Teste de erro de storage sem detalhes |

O SQL do contador de falhas usa `sql` parametrizado com identificadores do schema e ordem explícita de atribuições. O incremento é atômico e reinicia a contagem após 15 minutos sem falhas; ele não cria bloqueio persistente de conta. Não há concatenação de valores de usuários em SQL.

## 3. Controles existentes preservados

- Scrypt, salt aleatório, timingSafeEqual, HMAC, expiração de sessão, cookies HttpOnly/SameSite=Lax/Secure em produção; sem senha/hash nas respostas públicas.
- Zod; consultas parametrizadas; ordem/filtros SQL construídos com colunas conhecidas. A varredura não encontrou `.findFirst()`/`.findMany()` ou `sql.raw` alimentado por usuário no servidor.
- Helmet, x-powered-by desativado, HSTS em produção por 31.536.000 segundos, frame protection, nosniff, referrer policy e CSP de produção mantidos. As permissões de câmera/microfone/geolocalização agora são negadas; não foi encontrado fluxo cliente que as utilize.
- Atualização do PR com a main: preservada a CSP mais restritiva já integrada na main (imagens/frames self, data/blob conforme diretiva; fontes Google explícitas). Previews que redirecionam para storage externo precisam ser verificados em homologação, pois os hosts HTTPS externos deixaram de ser permitidos genericamente. Mantidos também os contêineres sem root da main.
- Tabelas globais `users`, `empresas` e credenciais não receberam empresaId artificial. A política já existente de leitura para `consulta` foi preservada.

## 4. Pendências externas

1. **Nginx/proxy:** confirmar IP real do hop que chega ao Express. Loopback cobre Nginx local; em rede Docker ou outro host, configurar TRUSTED_PROXY_CIDRS com IP/CIDR específico. Nunca `true`, `0.0.0.0/0` ou confiança em número de hops sem topologia fixa. Nginx deve sobrescrever X-Forwarded-Proto e propagar X-Forwarded-For corretamente; acesso direto ao backend deve ser restrito. [Referência Express](https://expressjs.com/en/guide/behind-proxies.html).
2. **HTTPS:** redirect HTTP→HTTPS permanece no Nginx. Verificar TLS e headers na implantação real. Não existe evidência da configuração de produção neste trabalho e ela não foi alterada.
3. **Limite distribuído:** orçamento de IP é por processo, reinicia junto com ele. Para múltiplos workers/instâncias, configurar limite compartilhado no gateway ou armazenamento compartilhado; não alegar limite global.
4. **Bot protection:** nenhuma chave/serviço externo foi inventado. CAPTCHA não é requisito do login. Se abuso distribuído justificar Turnstile, adicionar verificação server-side antes do hash, com feature flag desligada por padrão, segredo externo, timeout e validação de hostname/action. Só ativar com domínio e chaves provisionados e ensaio; nunca aceitar token apenas no frontend.
5. **RH:** [plano de criptografia autenticada e migração](RH-CRIPTOGRAFIA.md). A chave externa e migration aditiva precisam de aprovação; nada foi executado.
6. **Storage:** verificar que o bucket não possui acesso público paralelo e que URLs assinadas têm TTL curto. URLs assinadas já emitidas continuam utilizáveis até expirar; o proxy não pode revogá-las.
7. **MySQL/homologação:** ensaiar com banco isolado representativo. Testes desta rodada usam mocks e SQL gerado, sem conexão com MySQL real; não constituem teste de concorrência real do banco.

## 5. Dependências e secrets

[Relatório individual de advisories](SEGURANCA-DEPENDENCIAS.md): pacote, versão, GHSA/CVE quando fornecido, runtime/dev, caminho, alcance, correção e risco de compatibilidade. Atualizações direcionadas de tRPC, Drizzle, Vite, PostCSS e transitivas com advisories. Sem atualização geral da stack.

O serviço reportou inicialmente **41 ocorrências** (2 críticas, 20 altas, 18 moderadas, 1 baixa) e ao final **10 ocorrências** (1 crítica, 1 alta, 7 moderadas, 1 baixa), distribuídas em 9 registros finais de advisory. Remanescentes ligados a ferramentas dev/test, detalhados com condições de exposição; não é audit limpo.

Varredura do snapshot rastreado: o achado de URL com senha no `docker-compose.local.yml` foi removido, junto às senhas fixas do Compose. Agora ele exige referências externas sem defaults; [instruções para preservar as credenciais locais existentes](SEGREDOS-DOCKER-LOCAL.md). Nenhuma credencial real foi alterada e nenhum valor foi copiado ao relatório. Arquivos .env são ignorados. A nova varredura não encontrou correspondências nos formatos pesquisados. Não houve auditoria de todo o histórico Git, segredos em infraestrutura nem garantia de detectar todos os formatos possíveis. Evidência redigida: `validation/secrets-scan.json`.

## 6. Testes e build

Resultado: **429 testes aprovados em 82 arquivos**, typecheck e build aprovados. Evidências em `validation/tests-final.txt`, `validation/typecheck.txt`, `validation/build.txt` e JSONs de audit. Comandos: `pnpm test --maxWorkers=2 --minWorkers=1`, `pnpm check`, `pnpm build`, `pnpm audit --json`, `git diff --check`. Não há script de lint separado no package.json. O limite de workers reduz timeouts de UI sem aumentar prazos ou excluir testes.

Testes acrescentados: storage privado (5), limite por IP/batch/IPv6 (3), autorização/referências/mass assignment/projeção/calendário (5), upload (6), contador atômico de falhas sem bloqueio (1), cenários de senha incorreta e e-mail inexistente no login (2). Testes originais foram mantidos. Fixtures corrigidos após comparação com HEAD: empresa explícita para bancos simulados, retorno de `.where()` no mock de alertas, data local no teste do dashboard, URL blob válida no teste de PDF e expectativa de clearCookie (a expiração é gerada pelo Express, não por maxAge=-1 fornecido pelo router).

Limites: não houve teste end-to-end contra storage remoto, Nginx ou MySQL real. Warnings de tamanho de chunk e acessibilidade dos dialogs preexistentes permanecem; não impediram o build.

## 7. Banco

**Não houve alteração de schema. Não houve migration. Não foram apagados, convertidos ou criptografados dados existentes.** Não foi acessado o banco de produção. Os filtros podem tornar inacessíveis registros antigos de empresas diferentes da única empresa operacional — comportamento intencional de isolamento. Consistência de vínculos legados deve ser verificada em homologação, sem corrigir dados automaticamente.

## 8. Produção

**Nenhuma alteração foi realizada em produção.** Sem deploy, Oracle Cloud, DNS, firewall, Nginx ou mudanças de secrets. Entrega para revisão via PR, sem merge na main.

## 9. Riscos restantes

| Classificação | Risco/condição |
|---|---|
| CRÍTICO (advisory; exposição não constatada no ERP) | Vitest UI vulnerável se iniciado/exposto; script atual usa `vitest run`. Migração para versão corrigida deve ser tratada separadamente. |
| ALTO (condicional) | Proxy mal configurado ou bucket público pode contornar controles; infraestrutura não foi inspecionada. |
| MÉDIO | RH ainda legível no banco/backups; plano de criptografia pendente de chave e migração. |
| MÉDIO | Rate limit em memória não bloqueia botnet distribuída nem compartilha contadores entre instâncias. |
| MÉDIO | Falta de ensaio com MySQL real, dados legados e storage de homologação; verificação SQL/mock não cobre execução real/concor­rência. |
| BAIXO | Advisories dev/build restantes dependem de servidores/funções não usados na execução de produção; não expor ferramentas de desenvolvimento. |
| BAIXO | Credenciais antigas de demonstração permanecem no histórico Git; conferir eventual reutilização fora do ambiente local. O Compose agora requer segredos externos. |
| INFORMATIVO | Política `consulta` mantém leitura ampla; URLs assinadas são bearer links temporários; deploy ainda não realizado. |

Não há declaração de “sistema seguro”; os resultados acima delimitam o que foi corrigido e o que ainda exige validação externa.
