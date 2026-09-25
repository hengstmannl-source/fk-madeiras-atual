#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE_FILE="docker-compose.homologacao.yml"
SERVICE="app-homologacao"
DB_SERVICE="mysql-homologacao"

run_mysql() {
  docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" mysql \
    -u fk_madeiras_homologacao -phomologacao_app_password fkmadeiras_homologacao "$@"
}

wait_for_mysql() {
  for _ in $(seq 1 60); do
    if docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" mysqladmin ping \
      -h localhost -u root -phomologacao_root_password --silent >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "MySQL de homologação não ficou saudável." >&2
  return 1
}

if ! docker compose -f "$COMPOSE_FILE" ps --services --status running | grep -qx "$DB_SERVICE"; then
  docker compose -f "$COMPOSE_FILE" up -d "$DB_SERVICE"
fi
wait_for_mysql

mkdir -p artifacts
run_mysql -e "
  SELECT 'baseline' AS etapa;
  SELECT COUNT(*) AS journal_rows FROM __drizzle_migrations;
  SELECT COUNT(*) AS table_rows FROM information_schema.tables WHERE table_schema = DATABASE();
  SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name;
" > artifacts/homologacao-baseline.txt

# O primeiro comando usa exatamente o migrator do Drizzle. Não há inserção manual no journal.
docker compose -f "$COMPOSE_FILE" run --rm "$SERVICE" pnpm drizzle-kit migrate

# O segundo comando deve ser um no-op bem-sucedido, demonstrando idempotência.
docker compose -f "$COMPOSE_FILE" run --rm "$SERVICE" pnpm drizzle-kit migrate

docker compose -f "$COMPOSE_FILE" run --rm "$SERVICE" node scripts/verify-migrations.mjs | tee artifacts/homologacao-verificacao.json

run_mysql -e "
  SELECT 'final' AS etapa;
  SELECT COUNT(*) AS journal_rows FROM __drizzle_migrations;
  SELECT COUNT(*) AS table_rows FROM information_schema.tables WHERE table_schema = DATABASE();
  SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name;
" > artifacts/homologacao-final.txt

printf 'Homologação validada. Baseline: artifacts/homologacao-baseline.txt; final: artifacts/homologacao-final.txt.\n'
