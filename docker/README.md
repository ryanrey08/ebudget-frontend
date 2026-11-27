# eBudget frontend on Docker

This folder documents the Docker setup of the eBudget frontend (Next.js 15,
App Router, TypeScript, Tailwind CSS, Redux Toolkit / RTK Query). Only the
frontend is containerised. The Laravel backend runs in its own Compose project
and is reached over the network.

## Architecture

| File | Purpose |
| --- | --- |
| `Dockerfile` | Production image. Multi-stage: `deps` (`npm ci`), `builder` (`next build`, standalone output), `runner` (Node + standalone server only). Runs as the unprivileged `node` user, has a `HEALTHCHECK`. |
| `Dockerfile.dev` | Development image. `next dev` with hot reload and fast refresh. Dependencies live in the image. |
| `docker-compose.yml` | Shared settings: service `frontend`, port mapping, server-only env vars, `host.docker.internal`, network, `init`. |
| `docker-compose.dev.yml` | Dev override: `Dockerfile.dev`, source bind mount, container-only `node_modules` and `.next`, file polling. |
| `docker-compose.prod.yml` | Prod override: build args for `NEXT_PUBLIC_*`, restart policy, health check, dropped capabilities, log rotation. |
| `.dockerignore` | Keeps `node_modules`, `.next`, `.git`, all `.env*` files, tests and docs out of the build context. |
| `next.config.ts` | `output: "standalone"` is switched on only when `NEXT_OUTPUT=standalone` (set by the Dockerfile), so `npm run build` / `npm start` on the host behave exactly as before. |

```
                 ┌──────────────── browser ────────────────┐
                 │  http://localhost:3000                   │
                 │  NEXT_PUBLIC_* (compiled into the bundle)│
                 └───────────────┬──────────────────────────┘
                                 │ :3000
          ┌──────────────────────▼──────────────────────┐
          │ container ebudget-frontend(-dev)             │
          │ Next.js server  /api/auth/* auth proxy       │
          │                 /api/v1/*   data proxy       │
          │ BACKEND_API_URL (read at runtime)            │
          └──────────────────────┬──────────────────────┘
                                 │ http://host.docker.internal:8080/api/v1
          ┌──────────────────────▼──────────────────────┐
          │ Laravel backend (separate Compose project)  │
          └─────────────────────────────────────────────┘
```

The browser never calls the backend directly. It only talks to the frontend's
own origin: pages, `/api/auth/*` (sign-in) and, in `NEXT_PUBLIC_API_MODE=real`,
`/api/v1/*` (eBudget data). Those route handlers call `BACKEND_API_URL` from the
container with `Authorization: Bearer <token>` taken from the httpOnly session
cookie. So the backend needs no CORS setup and no public address: it can sit on
a private network (e.g. `http://10.15.0.14/api/v1`) with its public ports
closed, and the frontend's HTTPS never meets an `http://` backend URL.

The production image contains only `server.js`, the traced runtime
`node_modules` (Next, React, sharp for `next/image`), `.next/static` and
`public/`. No dev dependencies, no source, no `.env` files.

## Prerequisites

* Docker Desktop 4.x (macOS/Windows) or Docker Engine 24+ with the Compose v2
  plugin (Linux). Check with `docker compose version`.
* Port 3000 free on the host (or set `FRONTEND_PORT`). Stop a host
  `npm run dev` on 3000 first, or use another port.
* Node.js on the host is **not** required.

## Development

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

(or `npm run docker:dev`). Open http://localhost:3000.

* The project folder is bind-mounted at `/app`, so saved files hot reload in the
  browser (fast refresh keeps component state).
* `node_modules` and `.next` are container-only volumes: the host's
  `node_modules` (built for macOS) are never used, and the container never
  writes into the host's `.next`, so it can run next to a host `npm run dev`
  on another port (`FRONTEND_PORT=3001`).
* File watching uses the events Docker Desktop (VirtioFS) forwards from macOS,
  so polling is off (`WATCHPACK_POLLING=false`); polling cost a full CPU core
  while idle. If saved files stop hot reloading, start with
  `WATCHPACK_POLLING=true npm run docker:dev`.
* Dev mode compiles each page the first time it is opened (the dashboard is
  about 2,000 modules, which takes from ~30 s to over a minute depending on how
  busy the Mac is). Later visits are fast. To just use or demo the app, run the
  production container instead: pages load in milliseconds and it needs about
  100 MB of RAM instead of ~1 GB.
* Docker Desktop's memory limit (Settings → Resources) is shared by every
  running stack. If macOS starts swapping, stop stacks you aren't using or
  lower the limit so the Mac keeps enough RAM for itself.
* The container's environment overrides the host's `.env.local` (which is
  visible through the mount), so Docker-specific values such as
  `BACKEND_API_URL` win.

Stop and clean up (the `-v` removes the container-only `node_modules` / `.next`
volumes so they don't pile up):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
```

(or `npm run docker:dev:down`).

Run the tests or type check inside the dev image:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm --no-deps frontend sh -c "npx tsc --noEmit && env -u NEXT_PUBLIC_AUTH_MODE -u NEXT_PUBLIC_API_MODE npx vitest run"
```

(the tests expect the default mock configuration, hence the `env -u`).

## Production

```bash
# build the image
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
# start it in the background
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

(or `npm run docker:prod:build` and `npm run docker:prod:up`). Open
http://localhost:3000. `docker compose ps` shows `(healthy)` once the health
check passes.

The health check requests `/login`, an existing page that does not depend on
the backend. The container restarts `unless-stopped`, runs with `tini` as PID 1
(clean shutdown on `docker compose down`), as uid 1000, with all Linux
capabilities dropped and `no-new-privileges`. Logs rotate at 3 × 10 MB.

## Environment variables

Next.js has two kinds of variables, and Docker treats them differently:

| Kind | Examples | When it is read | How to change it in Docker |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_*` (browser-visible) | `NEXT_PUBLIC_API_MODE`, `NEXT_PUBLIC_AUTH_MODE` | **Build time.** `next build` inlines the values into the JavaScript bundle. | Prod: build args, then **rebuild** the image. Dev: container env, restart the container. |
| Server-only | `BACKEND_API_URL`, `BACKEND_SYSTEM`, `BACKEND_TIMEOUT_MS`, `SESSION_COOKIE_INSECURE`, `PORT` | **Runtime**, by the Node server (auth proxy in `src/app/api/auth`, data proxy in `src/app/api/v1`). | Container env, **restart** the container. No rebuild. |

Everything in `NEXT_PUBLIC_*` is visible to anyone who opens the app. Never put
secrets there. No `.env` file is copied into any image (`.dockerignore`).

Compose does not read `.env.local`. The compose files contain working defaults;
override them from the shell or an env file:

```bash
# one-off
NEXT_PUBLIC_AUTH_MODE=mock docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# or keep Docker settings in a git-ignored file (see the "Docker" section of .env.example)
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Defaults:

| Variable | Default | Notes |
| --- | --- | --- |
| `FRONTEND_PORT` | `3000` | Host port. The container always listens on 3000. |
| `NEXT_PUBLIC_API_MODE` | `mock` | `mock` serves eBudget data from the in-browser mock API; `real` sends it through the `/api/v1/*` data proxy to `BACKEND_API_URL`. |
| `NEXT_PUBLIC_AUTH_MODE` | `real` | Sign-in through the auth proxy and the backend. `mock` = demo accounts. |
| `BACKEND_API_URL` | `http://host.docker.internal:8080/api/v1` | Backend as seen **from inside the container**. |
| `BACKEND_SYSTEM` | `ebudget` | `ebudget`, `engas` or `sims`. |
| `SESSION_COOKIE_INSECURE` | `false` | Prod only. Browsers accept Secure cookies on `http://localhost`; set `true` only to test the prod image over plain http on another host name. |
| `FRONTEND_IMAGE` | `ebudget-frontend:latest` | Image name/tag for the prod build, e.g. a registry path. |

## API connectivity

`localhost` inside a container is the container itself, not your Mac and not
another container. Only one backend address matters, and only the container
uses it:

* **`BACKEND_API_URL`**: used by the Next.js auth and data proxies inside the
  container. `/api/v1/<path>` on the frontend is forwarded to
  `{BACKEND_API_URL}/{BACKEND_SYSTEM}/<path>`.
  * Backend in Docker Desktop on the same Mac, published on port 8080 (the
    Laravel stack's nginx): `http://host.docker.internal:8080/api/v1`
    (default).
  * Backend on the same Linux server, published on a host port: the same URL
    works because Compose maps `host.docker.internal` to the host gateway. The
    backend must listen on an address reachable from the Docker bridge (not
    only `127.0.0.1`).
  * Backend on another server: its URL. Prefer a private-network address
    (e.g. `http://10.15.0.14/api/v1` on a DigitalOcean VPC), so the backend's
    public ports can be closed; a public `https://` URL also works.
  * Backend in another Compose project: either use the published host port as
    above, or attach this service to that project's network and use its
    service name (e.g. `http://nginx/api/v1`).
* **Browser side**: nothing to configure. The browser only calls the
  frontend's own origin (`/api/auth/*`, `/api/v1/*`), so no backend address is
  compiled into the bundle and the backend needs no CORS rules for it.
  (`NEXT_PUBLIC_API_BASE_URL` is no longer passed to the build; if it is set
  elsewhere it must be a same-origin path, and a full URL is ignored.)

Check from inside the running container:

```bash
docker compose exec frontend sh -c 'echo $BACKEND_API_URL; wget -S -O /dev/null "$BACKEND_API_URL" 2>&1 | head -3'
```

Any HTTP status means the network path works; "Connection refused" means the
backend is not running or not published on that port.

## Container management

```bash
docker compose logs -f          # follow logs (npm run docker:logs)
docker compose ps               # status and health (npm run docker:ps)
docker compose restart frontend # restart after changing a runtime variable
docker compose down             # stop and remove the container
docker compose exec frontend sh # shell inside the container
```

The project name is fixed (`ebudget-frontend`), so `logs`, `ps`, `restart` and
`down` work without repeating the `-f` files.

## Rebuilding after dependency changes

* **Dev:** after `npm install <pkg>` (which updates `package.json` and
  `package-lock.json`), recreate the image and the container-only volumes:

  ```bash
  docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build --renew-anon-volumes
  ```

  Without `--renew-anon-volumes` the old `node_modules` volume would hide the
  new packages. You can also install inside the container:
  `docker compose exec frontend npm install <pkg>`.
* **Prod:** `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`.
  Only the `npm ci` layer reruns when `package*.json` changed; source-only
  changes reuse the cached dependency layer.

## Deploying to a Linux server

Option A, build on the server:

```bash
git clone <repo> ebudget-frontend && cd ebudget-frontend
cat > .env.docker <<'ENV'
NEXT_PUBLIC_API_MODE=real
NEXT_PUBLIC_AUTH_MODE=real
BACKEND_API_URL=http://10.15.0.14/api/v1
ENV
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Option B, build once and ship the image (build for the server's CPU):

```bash
# on the build machine (Apple Silicon Macs: target amd64 servers explicitly)
docker buildx build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_API_MODE=real \
  -t registry.example.com/ebudget-frontend:1.0.0 --push .

# on the server
docker run -d --name ebudget-frontend --init --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -e BACKEND_API_URL=http://10.15.0.14/api/v1 \
  -e BACKEND_SYSTEM=ebudget \
  --cap-drop ALL --security-opt no-new-privileges \
  registry.example.com/ebudget-frontend:1.0.0
```

Put a TLS-terminating reverse proxy (nginx, Caddy, Traefik) in front of port
3000 and forward the `Host` (or `X-Forwarded-Host`) header: the auth and data
proxies compare it with the browser's `Origin` to reject cross-site requests,
and the session cookie is `Secure`, so the site must be served over HTTPS.
The proxies pass the incoming `X-Forwarded-For` on to the backend, which
rate-limits per client IP; configure the backend to trust it only from the
frontend server's private address.

The reverse proxy is also what makes per-user rate limits on the backend
work: the auth proxy forwards the incoming `X-Forwarded-For` to the backend
but cannot see the client's IP itself. Caddy (and nginx with
`proxy_set_header X-Forwarded-For $remote_addr`) replaces any value a client
sends with the real address. Never publish port 3000 directly to the
internet: bind it to the loopback with `FRONTEND_PORT=127.0.0.1:3000` in
`.env.docker`, otherwise clients can reach Node directly and spoof the header.

Caddy setup with no domain yet (plain http, so `.env.docker` also needs
`SESSION_COOKIE_INSECURE=true` until HTTPS is in place). The app moves to the
loopback on port 3100, and Caddy serves it on port 80 and on the old port 3000,
so existing `http://<server>:3000` links keep working:

```bash
apt install -y caddy
printf ':80, :3000 {\n    reverse_proxy 127.0.0.1:3100\n}\n' > /etc/caddy/Caddyfile
systemctl reload caddy
# in .env.docker:
#   FRONTEND_PORT=127.0.0.1:3100
```

With a domain, replace `:80, :3000` with the domain name. Caddy then obtains a
certificate and serves HTTPS, and `SESSION_COOKIE_INSECURE` goes back to `false`.
Each further app gets its own loopback port (3101, 3102, ...) and its own
domain block in the same Caddyfile.

## Automatic deploys (GitHub Actions)

`.github/workflows/deploy.yml`:

1. **check** (every pull request and push to `main`): `npm ci`, type check and
   tests.
2. **image** (`main` only, after check): builds the production image in
   GitHub Actions and pushes it to
   `ghcr.io/ryanrey08/ebudget-frontend:sha-<commit>`. Layers are cached, so
   dependencies are reinstalled only when `package-lock.json` changes.
   `NEXT_PUBLIC_*` values come from repository variables (Settings → Secrets
   and variables → Actions → **Variables**); unset ones use the Dockerfile
   defaults.
3. **deploy**: connects over SSH and sends `deploy <commit>` plus a
   short-lived, read-only registry token. Nothing else is sent.

Nothing is built on the server: `next build` needs up to 2.5 GB of RAM, more
than the server can spare next to the running apps. On the server, the
Actions key is pinned to [`deploy.sh`](deploy.sh), installed as
`/usr/local/sbin/ebudget-frontend-deploy`. The script:

- pulls the image for that commit and checks out the same commit (compose files);
- starts it and waits for the `/login` health check (`up --wait`);
- if the new release is unhealthy, starts the previous commit and image again
  and fails the job;
- records every attempt in `/var/lib/ebudget-frontend/releases` and keeps the
  images of the last five releases, so rollbacks work without GitHub.

The container is capped at 384 MB (`FRONTEND_MEM_LIMIT` in `.env.docker`), so
one busy app cannot starve the others on the server.

### Rolling back

GitHub: **Actions → Rollback → Run workflow**. Leave `target_sha` empty to go
back one release (run it again to go back further), or give an earlier
released commit, and enter a `reason`. Run it first with `confirm` empty: it
only shows the live release and the target. Then run it again with `confirm`
set to `ROLLBACK`. A rollback lasts until the next deploy from `main`.

On the server, as root:

```bash
ebudget-frontend-deploy releases
ebudget-frontend-deploy rollback
```

### One-time server setup

As root, with the repo cloned to `/root/ebudget-frontend` and `.env.docker`
in place:

```bash
# 1. Install the deploy script outside the checkout, so a rollback to an older
#    commit cannot replace the script doing it. Repeat when deploy.sh changes.
install -m 0755 /root/ebudget-frontend/docker/deploy.sh /usr/local/sbin/ebudget-frontend-deploy

# 2. Pin the existing Actions key to it (no shell, no forwarding)
cp -p ~/.ssh/authorized_keys ~/.ssh/authorized_keys.bak
sed -i '/github-actions-deploy$/s|^ssh-|command="sh /usr/local/sbin/ebudget-frontend-deploy",restrict ssh-|' ~/.ssh/authorized_keys

# 3. Print the value for the DEPLOY_KNOWN_HOSTS secret
for f in /etc/ssh/ssh_host_*_key.pub; do
  printf '%s %s\n' "<server ip>" "$(cut -d' ' -f1,2 "$f")"
done
```

Repository secrets (Settings → Secrets and variables → Actions → **Repository
secrets**; on a personal repository only the owner can add them):

| Secret | Value |
| --- | --- |
| `SERVER_HOST` | The server's IP or host name. |
| `SERVER_SSH_KEY` | The private half of the `github-actions-deploy` key, including the `BEGIN`/`END` lines. |
| `DEPLOY_KNOWN_HOSTS` | The host key lines from step 3. They are read on the server itself, so a man-in-the-middle cannot substitute its own key. |

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `Bind for 0.0.0.0:3000 failed: port is already allocated` | Something (often a host `npm run dev`) uses 3000. Stop it or run with `FRONTEND_PORT=3001`. |
| Sign-in fails with "Unable to reach the eBudget server" (503) | `BACKEND_API_URL` is not reachable from the container. Is the backend running (`curl http://localhost:8080` on the host)? Never use `localhost` in `BACKEND_API_URL`. |
| Sign-in or data requests return 403 "Cross-site requests are not allowed" | A reverse proxy rewrites `Host` without setting `X-Forwarded-Host`. Forward the original host. |
| Real-mode data requests fail with 503 / 504 | The `/api/v1/*` data proxy cannot reach `BACKEND_API_URL` from the container (see the check above), or the backend took longer than `BACKEND_TIMEOUT_MS`. |
| Changed a `NEXT_PUBLIC_*` value but the prod app still uses the old one | It is compiled in. Rebuild: `... -f docker-compose.prod.yml up -d --build`. |
| Edits don't hot reload | Start with `WATCHPACK_POLLING=true`. Check `docker compose logs -f` for "Compiled". |
| Pages are very slow in dev | First visit of each page compiles it (normal). If every load is slow, check the Mac for swapping (Activity Monitor → Memory) and stop unused Docker stacks, or use the production container. |
| `Module not found` in dev after adding a package | Stale `node_modules` volume: `up --build --renew-anon-volumes`. |
| Container is `unhealthy` | `docker compose logs frontend` shows the startup error; `docker inspect --format '{{json .State.Health}}' ebudget-frontend` shows the check output. |
| Build fails at `next build` | The same command fails on the host too (`npm run build`): fix the type/lint error it prints. |
| Linux dev: `EACCES` when Next writes `next-env.d.ts` | The dev container runs as uid 1000; give that uid write access to the project folder, or run your host user as uid 1000. |
| Disk usage grows | `docker compose ... down -v` for dev, `docker image prune` for old images, `docker builder prune` for build cache. |
