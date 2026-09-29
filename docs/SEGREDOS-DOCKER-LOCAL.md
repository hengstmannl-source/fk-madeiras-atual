# Credenciais do Compose local

`docker-compose.local.yml` não contém mais senhas fixas ou URL com senha. Antes de usar esse Compose, defina no arquivo **ignorado** `.env.docker`:

- `FK_MYSQL_PASSWORD`: senha **já existente** do usuário `fk_madeiras`.
- `FK_MYSQL_ROOT_PASSWORD`: senha **já existente** do root do MySQL local.
- `FK_DOCKER_DATABASE_URL`: URL MySQL completa do aplicativo, com host `mysql`, porta interna `3306` e banco `fkmadeiras`. Faça percent-encoding dos componentes de usuário/senha quando necessário.

Passe o arquivo com `docker compose --env-file .env.docker -f docker-compose.local.yml ...`, conforme o fluxo local existente. Não imprima `docker compose config` ou esse arquivo em logs compartilhados: a interpolação pode revelar credenciais.

Para um volume já inicializado, preserve as credenciais reais: mudar a variável não muda a senha armazenada no MySQL. Não remova o volume, não execute scripts de criação de usuários e não rotacione senhas como parte deste PR. Não foi executado Docker, migration, SQL de alteração de senha ou operação no volume.

Valores antigos permanecem no histórico Git. São credenciais de demonstração; se tiverem sido reutilizadas fora desse ambiente, a avaliação/rotação deve ser conduzida pelo responsável, fora desta rodada e sem divulgar valores no PR.
