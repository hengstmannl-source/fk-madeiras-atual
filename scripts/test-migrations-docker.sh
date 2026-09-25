#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE_FILE="docker-compose.migrations-test.yml"

cleanup() {
  docker compose -f "$COMPOSE_FILE" down --remove-orphans
}
trap cleanup EXIT

docker compose -f "$COMPOSE_FILE" up --build --abort-on-container-exit --exit-code-from migration-test
