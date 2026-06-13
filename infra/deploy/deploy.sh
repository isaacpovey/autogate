#!/usr/bin/env bash
# Runs ON the EC2 host, from the infra/deploy directory of the synced repo.
# Builds and (re)starts the full autogate stack behind the Caddy HTTPS endpoint.
set -euo pipefail

cd "$(dirname "$0")"

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Copy .env.production.example -> $ENV_FILE and fill secrets." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

dc() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

echo "==> Validating compose config"
dc config >/dev/null

echo "==> Building images (this can take a few minutes on first run)"
dc build

echo "==> Starting stack"
dc up -d --remove-orphans

echo "==> Waiting for services to become healthy"
for i in $(seq 1 60); do
  if dc ps --format '{{.Service}} {{.Health}} {{.State}}' | grep -Eq 'unhealthy'; then
    echo "  a service reported unhealthy:" >&2
    dc ps >&2
  fi
  not_ready=$(dc ps --format '{{.Service}} {{.State}}' | grep -Ev 'running' || true)
  if [[ -z "$not_ready" ]]; then
    echo "  all services running"
    break
  fi
  sleep 3
done

echo "==> Current status"
dc ps

SITE="${SITE_ADDRESS:-autogate.tyrongarratt.com}"
echo "==> Smoke test through Caddy (self-signed accepted)"
echo "--- web root ---"
curl -ksS -o /dev/null -w 'HTTP %{http_code}\n' --resolve "${SITE}:443:127.0.0.1" "https://${SITE}/" || true
echo "--- api (tRPC health query) ---"
curl -ksS --resolve "${SITE}:443:127.0.0.1" "https://${SITE}/api/health" -w '\nHTTP %{http_code}\n' || true

echo "==> Done. Tail logs with: docker compose -f $COMPOSE_FILE logs -f"
