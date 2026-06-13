#!/usr/bin/env bash
# Runs FROM the laptop. Syncs the repo to the EC2 host over SSH and triggers a
# remote build + deploy. SSH reaches the box on its private IP; the public IP
# (13.239.41.73) only serves 80/443.
#
#   SSH_HOST=10.13.22.71 ./ship.sh
#
# Requires: an SSH key for ec2-user loaded in the agent, and a local
# infra/deploy/.env.production (gitignored) with real secrets — it is copied to
# the host and never committed.
set -euo pipefail

SSH_USER="${SSH_USER:-ec2-user}"
SSH_HOST="${SSH_HOST:-10.13.22.71}"
REMOTE_DIR="${REMOTE_DIR:-/home/ec2-user/autogate}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SSH_TARGET="${SSH_USER}@${SSH_HOST}"

echo "==> Checking SSH connectivity to ${SSH_TARGET}"
if ! ssh -o BatchMode=yes -o ConnectTimeout=15 "$SSH_TARGET" 'echo ok' >/dev/null 2>&1; then
  echo "ERROR: cannot SSH to ${SSH_TARGET}." >&2
  echo "  - Is the EC2 key loaded?  ssh-add -l" >&2
  echo "  - Is the private network/VPN path to ${SSH_HOST} up?" >&2
  exit 1
fi

echo "==> Syncing repo to ${SSH_TARGET}:${REMOTE_DIR}"
ssh "$SSH_TARGET" "mkdir -p '$REMOTE_DIR'"
rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '**/node_modules' \
  --exclude '**/.next' \
  --exclude '**/.turbo' \
  --exclude '**/dist' \
  --exclude '**/build' \
  --exclude '**/out' \
  --exclude '*.log' \
  "$REPO_ROOT/" "$SSH_TARGET:$REMOTE_DIR/"

LOCAL_ENV="$SCRIPT_DIR/.env.production"
if [[ -f "$LOCAL_ENV" ]]; then
  echo "==> Copying .env.production to host"
  scp "$LOCAL_ENV" "$SSH_TARGET:$REMOTE_DIR/infra/deploy/.env.production"
else
  echo "WARN: no local infra/deploy/.env.production found." >&2
  echo "      Create it on the host from .env.production.example before deploying." >&2
fi

echo "==> Running remote deploy"
ssh "$SSH_TARGET" "cd '$REMOTE_DIR/infra/deploy' && chmod +x deploy.sh && ./deploy.sh"
