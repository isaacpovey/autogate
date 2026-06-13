# Deploying autogate to EC2 (single HTTPS endpoint)

The whole stack runs on one EC2 host behind a single Caddy HTTPS endpoint for
`autogate.tyrongarratt.com`.

```
                         autogate.tyrongarratt.com  (DNS -> 13.239.41.73)
                                      │  :443 / :80
                              ┌───────▼────────┐
                              │     caddy      │  TLS termination + routing
                              └───┬────────┬───┘
                  /api/* (strip)  │        │  everything else
                          ┌───────▼──┐  ┌──▼────────┐
                          │ api:4000 │  │ web:3000  │
                          └────┬─────┘  └───────────┘
                   ┌───────────┼────────────┐
              ┌────▼────┐ ┌────▼────┐  ┌─────▼─────┐
              │postgres │ │ qdrant  │  │  worker   │
              └─────────┘ └─────────┘  └───────────┘
```

- `/api/*` → `api:4000` with the `/api` prefix **stripped** (Caddy `handle_path`),
  so the tRPC standalone server (which serves procedures at root) sees `/health`,
  `/runs.list`, etc.
- Everything else → `web:3000` (Next.js).
- Only Caddy publishes host ports. Backends are internal-only.

## Hosts

| Purpose | Address |
| --- | --- |
| SSH (private) | `ec2-user@10.13.22.71` |
| Public HTTPS (DNS target) | `13.239.41.73` |
| Domain | `autogate.tyrongarratt.com` |

## One-time prerequisites on the host

- Docker + Docker Compose v2 (`docker compose version`).
- The repo synced to `/home/ec2-user/autogate` (handled by `ship.sh`).
- `infra/deploy/.env.production` present with real secrets (copied by `ship.sh`
  from your local gitignored copy, or created on the host from
  `.env.production.example`).

## Deploy

From your laptop (SSH key for `ec2-user` loaded in the agent, private-network
path to `10.13.22.71` up):

```bash
SSH_HOST=10.13.22.71 infra/deploy/ship.sh
```

`ship.sh` rsyncs the repo, copies `.env.production`, then runs `deploy.sh` on the
host, which builds the images, starts the stack, waits for health, and runs a
smoke test through Caddy.

To run only the host side (when already on the box):

```bash
cd /home/ec2-user/autogate/infra/deploy && ./deploy.sh
```

## Certificate: pre-DNS vs live

The endpoint is built to work **before** DNS exists and flip to a real cert with
one change.

- **Pre-DNS (default):** `TLS_DIRECTIVE=tls internal` → Caddy serves a self-signed
  cert. The endpoint is fully testable on the host:
  ```bash
  curl -k --resolve autogate.tyrongarratt.com:443:127.0.0.1 https://autogate.tyrongarratt.com/
  curl -k --resolve autogate.tyrongarratt.com:443:127.0.0.1 https://autogate.tyrongarratt.com/api/health
  ```
- **Go live (after DNS `autogate.tyrongarratt.com` → `13.239.41.73`):** set
  `TLS_DIRECTIVE=` (empty) in `.env.production` and restart Caddy. Caddy then
  obtains a Let's Encrypt cert automatically over the public IP (ports 80/443
  must be open in the security group):
  ```bash
  cd /home/ec2-user/autogate/infra/deploy
  sed -i 's/^TLS_DIRECTIVE=.*/TLS_DIRECTIVE=/' .env.production
  docker compose -f docker-compose.prod.yml --env-file .env.production up -d caddy
  docker compose -f docker-compose.prod.yml logs -f caddy   # watch cert issuance
  ```

## Open blockers (need you)

1. **SSH key** — no identity is loaded in the 1Password agent (`ssh-add -l` →
   "agent has no identities"). Unlock 1Password / add the `ec2-user` key.
2. **Private-network path** — TCP/22 to `10.13.22.71` opens but the SSH banner
   exchange times out. Bring up the VPN/network route to the private IP.
3. **DNS** — point `autogate.tyrongarratt.com` → `13.239.41.73`, then flip
   `TLS_DIRECTIVE` as above. Ensure the security group allows inbound 80/443.

## Operations

```bash
cd /home/ec2-user/autogate/infra/deploy
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml down          # stop
docker compose -f docker-compose.prod.yml up -d --build  # rebuild + restart
```
