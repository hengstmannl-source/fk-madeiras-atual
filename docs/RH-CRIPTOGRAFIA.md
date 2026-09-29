# Proteção dos dados de RH — proposta, não ativada

Esta rodada não criptografa linhas existentes, não altera schema e não gera chaves. A ativação depende de aprovação de migration aditiva, provisionamento de segredo e ensaio com cópia restaurável do banco. Não executar em produção como parte deste PR.

## Inventário e compatibilidade

| Campos | Uso observado | Tratamento proposto |
|---|---|---|
| `colaboradoresRh.cpf`, `dependentesRh.cpf` | Cadastro; CPF do colaborador participa da busca por substring em memória em `rh.colaboradores.list` | Cifra autenticada; manter busca em memória após descriptografia autorizada durante transição. Índice HMAC permitiria igualdade, **não** substitui a busca parcial atual. |
| RG, PIS, banco, agência, conta bancária, chave PIX | Cadastro/edição e retorno do registro completo; não encontrados como chave ou filtro SQL em `server` | Primeiros candidatos a criptografia em campos paralelos de tamanho adequado. |
| Nome, e-mail, telefone, nascimento, admissão/desligamento | Nome ordenado no SQL; nome/e-mail buscados em memória; datas usadas operacionalmente | Exigem redesenho específico da busca/ordenação. Não aplicar criptografia automaticamente. |
| Salário atual, históricos salariais, itens de folha, adiantamentos e benefícios | Cálculos, relatórios, geração de títulos e memória de cálculo replicam valores em várias tabelas | Mapear todas as cópias antes de ativar. Criptografar só `salarioAtual` daria proteção incompleta e exigiria adaptação dos tipos decimais. |
| Observações e auditorias | Texto livre e snapshots podem conter dados pessoais | Minimizar novos snapshots; definir retenção e acesso. Não reescrever históricos nesta rodada. |

O resumo de `rh.controle` agora seleciona explicitamente apenas identificação, situação, departamento/cargo e salário necessários. O cadastro completo continua acessível sob a política operacional existente, inclusive o perfil `consulta` para leituras. Alterar essa política exige decisão do responsável pelo negócio.

## Formato e chaves

Usar AES-256-GCM do `node:crypto`, chave aleatória de 32 bytes, nonce aleatório de 12 bytes por campo/gravação e tag de autenticação de 16 bytes. Envelope versionado: `{v:1,kid,iv,tag,ciphertext}`, valores binários em base64. AAD canônica inclui versão, empresa, tabela, ID do registro e nome do campo; copiar ciphertext entre colaboradores, empresas ou campos deve falhar na autenticação.

Chaves vêm de um gerenciador de segredos/configuração externa (proposta: `RH_DATA_KEYS`, mapa `kid -> base64`, e `RH_DATA_ACTIVE_KID`). Nunca reutilizar JWT_SECRET, nunca gerar chave automaticamente na inicialização e nunca registrar chaves/plaintext em logs. Chave ausente, envelope inválido, `kid` desconhecido ou tag incorreta devem falhar fechados. Não interpretar falha de descriptografia como texto legado.

Referência de implementação: [Node.js — cipher/decipher e tags GCM](https://nodejs.org/api/crypto.html). Guardar versões antigas das chaves até verificar a recriptografia e o ciclo de retenção dos backups.

## Migração proposta

1. Inventariar relatórios, integrações, exportações e cópias dos campos; realizar backup e ensaio de restauração em ambiente isolado.
2. Provisionar a chave fora do repositório. Aprovar migration **aditiva** com colunas/tabela paralelas nullable de tamanho TEXT/JSON, sem reduzir colunas atuais ou converter decimais.
3. Implantar leitura compatível: envelope presente → descriptografar; envelope ausente e versão legada explícita → ler coluna antiga. Nunca fallback após erro de autenticação. Escrita dupla temporária exige aprovação explícita, pois conserva plaintext.
4. Backfill em lotes pequenos por empresa e ID, com checkpoints e atualização condicional para não sobrescrever edições concorrentes. Não imprimir dados; registrar apenas contagens, IDs e status.
5. Verificar ida/volta, tag adulterada, empresa/campo/ID trocados, Unicode, nulos, chave incorreta/ausente, rotação, concorrência, busca parcial de CPF e cálculos de folha.
6. Só após validação operacional, aprovar a remoção do plaintext em janela separada, incluindo tratamento de backups. Até essa etapa, declarar explicitamente que o banco ainda contém dados legíveis.
7. Rollback antes da remoção usa campos originais. Depois da remoção, exige as chaves válidas e plano de restauração testado; nunca excluir a chave para “desativar” a funcionalidade.

Risco remanescente **MÉDIO**: acesso indevido ao banco/backup ainda expõe dados de RH. Criptografia em aplicação reduz esse risco, mas não protege contra um processo da aplicação já comprometido que possua a chave.
