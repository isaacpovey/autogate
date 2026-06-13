#!/usr/bin/env bash
#
# Autogate one-command boot for a fresh single-node (Ubuntu/Debian EC2) box.
# Installs Docker + Compose + Node/pnpm, clones the repo, installs deps,
# writes .env, runs DB migrations + repo ingestion, then `docker-compose up`.
#
# Usage:
#   ./setup.sh            # clone fresh into ./auto-gate and boot
#   REPO_DIR=/srv/app ./setup.sh
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/askable/auto-gate.git}"
REPO_DIR="${REPO_DIR:-auto-gate}"
REPO_BRANCH="${REPO_BRANCH:-main}"

log() {
  printf '\n=== %s ===\n' "$1"
}

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    SUDO="sudo"
  else
    SUDO=""
  fi
}

install_docker() {
  if command -v docker >/dev/null 2>&1; then
    log "Docker already installed: $(docker --version)"
    return
  fi
  log "Installing Docker Engine + Compose plugin"
  $SUDO apt-get update -y
  $SUDO apt-get install -y ca-certificates curl gnupg
  $SUDO install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  $SUDO chmod a+r /etc/apt/keyrings/docker.gpg
  local codename
  codename="$(. /etc/os-release && echo "${VERSION_CODENAME}")"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${codename} stable" \
    | $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null
  $SUDO apt-get update -y
  $SUDO apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  $SUDO systemctl enable --now docker
}

install_node() {
  if command -v node >/dev/null 2>&1; then
    log "Node already installed: $(node --version)"
  else
    log "Installing Node.js 22 LTS"
    curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO -E bash -
    $SUDO apt-get install -y nodejs
  fi
  log "Enabling pnpm via corepack"
  $SUDO corepack enable
  corepack prepare pnpm@10.24.0 --activate
}

clone_repo() {
  if [ -d "${REPO_DIR}/.git" ]; then
    log "Repo already present at ${REPO_DIR}; pulling latest"
    git -C "${REPO_DIR}" pull --ff-only
  else
    log "Cloning ${REPO_URL} (${REPO_BRANCH}) into ${REPO_DIR}"
    git clone --branch "${REPO_BRANCH}" "${REPO_URL}" "${REPO_DIR}"
  fi
}

write_env() {
  local env_path="${REPO_DIR}/.env"
  if [ -f "${env_path}" ]; then
    log ".env already exists at ${env_path}; leaving as-is"
    return
  fi
  log "Writing ${env_path} from infra/.env.example (fill in secrets before boot)"
  cp "${REPO_DIR}/infra/.env.example" "${env_path}"
  cat <<'NOTE'
NOTE: edit .env to supply OPENAI_API_KEY and GITHUB_APP_* secrets,
then re-run this script (existing .env is preserved).
NOTE
}

install_deps() {
  log "Installing workspace dependencies (pnpm install)"
  (cd "${REPO_DIR}" && pnpm install --frozen-lockfile)
}

start_services() {
  log "Starting Postgres + Qdrant"
  (cd "${REPO_DIR}/infra" && docker compose up -d postgres qdrant)
}

run_migrations() {
  log "Running database migrations (store-postgres)"
  (cd "${REPO_DIR}" && pnpm --filter @autogate/store-postgres migrate)
}

run_ingestion() {
  log "Running repo ingestion into Qdrant (memory-qdrant)"
  (cd "${REPO_DIR}" && pnpm --filter @autogate/memory-qdrant ingest)
}

boot_stack() {
  log "Booting full stack (docker-compose up)"
  (cd "${REPO_DIR}/infra" && docker compose up -d --build)
  log "Stack is up. Dashboard: http://localhost:3000  API: http://localhost:4000"
}

main() {
  require_root
  install_docker
  install_node
  clone_repo
  write_env
  install_deps
  start_services
  run_migrations
  run_ingestion
  boot_stack
}

main "$@"
