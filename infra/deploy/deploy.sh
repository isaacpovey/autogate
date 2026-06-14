#!/usr/bin/env bash
# Runs ON the host, from the infra/deploy directory of the synced repo.
# Builds and (re)starts the full autogate stack behind the Caddy HTTPS endpoint.
set -euo pipefail

cd "$(dirname "$0")"

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Copy .env.production.example -> $ENV_FILE and fill secrets." >&2
  exit 1
fi

# NOTE: do not `source` the env file — it is a docker-compose env file whose
# values (e.g. `TLS_DIRECTIVE=tls internal`) may contain spaces and are not
# shell-quoted. Compose parses it via --env-file; here we only need SITE_ADDRESS
# for the smoke test, so extract that one value literally.
SITE_ADDRESS=$(sed -n 's/^SITE_ADDRESS=//p' "$ENV_FILE" | head -1)

dc() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

echo "==> Validating compose config"
dc config >/dev/null

echo "==> Building images (this can take a few minutes on first run)"
dc build

echo "==> Starting stack"
dc up -d --remove-orphans

echo "==> Waiting for services to become healthy"
ready=false
for i in $(seq 1 60); do
  states=$(dc ps --format '{{.Service}} {{.State}} {{.Health}}')
  if grep -q 'unhealthy' <<<"$states"; then
    echo "ERROR: a service became unhealthy:" >&2
    echo "$states" >&2
    dc logs --tail 50 >&2
    exit 1
  fi
  # Ready = State "running" and Health empty (no healthcheck) or "healthy".
  not_ready=$(awk '$2 != "running" || ($3 != "" && $3 != "healthy")' <<<"$states")
  if [[ -z "$not_ready" ]]; then
    ready=true
    echo "  all services running and healthy"
    break
  fi
  sleep 3
done

if [[ "$ready" != true ]]; then
  echo "ERROR: services did not become healthy within the timeout." >&2
  dc ps >&2
  dc logs --tail 50 >&2
  exit 1
fi

echo "==> Current status"
dc ps

SITE="${SITE_ADDRESS:-autogate.tyrongarratt.com}"
echo "==> Smoke test through Caddy (self-signed accepted)"
smoke_fail=0
web_code=$(curl -ksS -o /dev/null -w '%{http_code}' --resolve "${SITE}:443:127.0.0.1" "https://${SITE}/" || echo 000)
echo "--- web root: HTTP ${web_code}"
[[ "$web_code" == 2* || "$web_code" == 3* ]] || smoke_fail=1
api_code=$(curl -ksS -o /dev/null -w '%{http_code}' --resolve "${SITE}:443:127.0.0.1" "https://${SITE}/api/health" || echo 000)
echo "--- api /api/health: HTTP ${api_code}"
[[ "$api_code" == 2* ]] || smoke_fail=1

if [[ "$smoke_fail" != 0 ]]; then
  echo "ERROR: smoke test failed (see HTTP codes above)." >&2
  dc logs --tail 50 caddy web api >&2
  exit 1
fi

echo "==> Deploy OK. Tail logs with: docker compose -f $COMPOSE_FILE logs -f"
