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
          │ BACKEND_API_URL (read at runtime)            │
          └──────────────────────┬──────────────────────┘
                                 │ http://host.docker.internal:8080/api/v1
          ┌──────────────────────▼──────────────────────┐
          │ Laravel backend (separate Compose project)  │
          └─────────────────────────────────────────────┘
```

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
| `NEXT_PUBLIC_*` (browser-visible) | `NEXT_PUBLIC_API_MODE`, `NEXT_PUBLIC_AUTH_MODE`, `NEXT_PUBLIC_API_BASE_URL` | **Build time.** `next build` inlines the values into the JavaScript bundle. | Prod: build args, then **rebuild** the image. Dev: container env, restart the container. |
| Server-only | `BACKEND_API_URL`, `BACKEND_SYSTEM`, `BACKEND_TIMEOUT_MS`, `SESSION_COOKIE_INSECURE`, `PORT` | **Runtime**, by the Node server (auth proxy in `src/app/api/auth`). | Container env, **restart** the container. No rebuild. |

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
| `NEXT_PUBLIC_API_MODE` | `mock` | `mock` serves eBudget data from the in-browser mock API. |
| `NEXT_PUBLIC_AUTH_MODE` | `real` | Sign-in through the auth proxy and the backend. `mock` = demo accounts. |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000/api` | Data API as seen **from the browser**. |
| `BACKEND_API_URL` | `http://host.docker.internal:8080/api/v1` | Backend as seen **from inside the container**. |
| `BACKEND_SYSTEM` | `ebudget` | `ebudget`, `engas` or `sims`. |
| `SESSION_COOKIE_INSECURE` | `false` | Prod only. Browsers accept Secure cookies on `http://localhost`; set `true` only to test the prod image over plain http on another host name. |
| `FRONTEND_IMAGE` | `ebudget-frontend:latest` | Image name/tag for the prod build, e.g. a registry path. |

## API connectivity

`localhost` inside a container is the container itself, not your Mac and not
another container. Two different addresses matter:

* **Server side (`BACKEND_API_URL`)**: used by the Next.js auth proxy inside the
  container.
  * Backend in Docker Desktop on the same Mac, published on port 8080 (the
    Laravel stack's nginx): `http://host.docker.internal:8080/api/v1`
    (default).
  * Backend on the same Linux server, published on a host port: the same URL
    works because Compose maps `host.docker.internal` to the host gateway. The
    backend must listen on an address reachable from the Docker bridge (not
    only `127.0.0.1`).
  * Backend on another server: its URL, e.g. `https://api.example.gov.ph/api/v1`.
  * Backend in another Compose project: either use the published host port as
    above, or attach this service to that project's network and use its
    service name (e.g. `http://nginx/api/v1`).
* **Browser side (`NEXT_PUBLIC_API_BASE_URL`)**: used by the user's browser in
  `NEXT_PUBLIC_API_MODE=real`, so it must be an address the browser can reach:
  `http://localhost:8080/...` locally, the public `https://` URL in production.
  Changing it requires a rebuild of the prod image.

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
NEXT_PUBLIC_API_BASE_URL=https://api.example.gov.ph/api
BACKEND_API_URL=https://api.example.gov.ph/api/v1
ENV
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Option B, build once and ship the image (build for the server's CPU):

```bash
# on the build machine (Apple Silicon Macs: target amd64 servers explicitly)
docker buildx build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_API_MODE=real \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.gov.ph/api \
  -t registry.example.com/ebudget-frontend:1.0.0 --push .

# on the server
docker run -d --name ebudget-frontend --init --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -e BACKEND_API_URL=https://api.example.gov.ph/api/v1 \
  -e BACKEND_SYSTEM=ebudget \
  --cap-drop ALL --security-opt no-new-privileges \
  registry.example.com/ebudget-frontend:1.0.0
```

Put a TLS-terminating reverse proxy (nginx, Caddy, Traefik) in front of port
3000 and forward the `Host` (or `X-Forwarded-Host`) header: the auth proxy
compares it with the browser's `Origin` to reject cross-site requests, and the
session cookie is `Secure`, so the site must be served over HTTPS.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `Bind for 0.0.0.0:3000 failed: port is already allocated` | Something (often a host `npm run dev`) uses 3000. Stop it or run with `FRONTEND_PORT=3001`. |
| Sign-in fails with "Unable to reach the eBudget server" (503) | `BACKEND_API_URL` is not reachable from the container. Is the backend running (`curl http://localhost:8080` on the host)? Never use `localhost` in `BACKEND_API_URL`. |
| Sign-in returns 403 "Cross-site requests are not allowed" | A reverse proxy rewrites `Host` without setting `X-Forwarded-Host`. Forward the original host. |
| Changed a `NEXT_PUBLIC_*` value but the prod app still uses the old one | It is compiled in. Rebuild: `... -f docker-compose.prod.yml up -d --build`. |
| Edits don't hot reload | Start with `WATCHPACK_POLLING=true`. Check `docker compose logs -f` for "Compiled". |
| Pages are very slow in dev | First visit of each page compiles it (normal). If every load is slow, check the Mac for swapping (Activity Monitor → Memory) and stop unused Docker stacks, or use the production container. |
| `Module not found` in dev after adding a package | Stale `node_modules` volume: `up --build --renew-anon-volumes`. |
| Container is `unhealthy` | `docker compose logs frontend` shows the startup error; `docker inspect --format '{{json .State.Health}}' ebudget-frontend` shows the check output. |
| Build fails at `next build` | The same command fails on the host too (`npm run build`): fix the type/lint error it prints. |
| Linux dev: `EACCES` when Next writes `next-env.d.ts` | The dev container runs as uid 1000; give that uid write access to the project folder, or run your host user as uid 1000. |
| Disk usage grows | `docker compose ... down -v` for dev, `docker image prune` for old images, `docker builder prune` for build cache. |
