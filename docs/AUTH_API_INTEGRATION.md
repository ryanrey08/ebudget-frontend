# Authentication API integration

How the eBudget frontend signs in against the existing backend
(`~/Desktop/backend/backend-api/backend-api`, Laravel 12). Everything here was
read from the backend source; the backend was not changed.

Backend files this is based on:

| What | Backend file |
| --- | --- |
| Routes | `routes/api.php` |
| Controller | `app/Http/Controllers/Api/V1/SystemAuthController.php` |
| Login validation | `app/Http/Requests/Api/V1/LoginRequest.php` |
| Credential check, token issue | `app/Actions/Auth/IssueSystemToken.php` |
| User payload | `app/Http/Resources/Api/V1/CurrentSystemUserResource.php`, `SystemUserResource.php` |
| Error format | `app/Exceptions/ApiExceptionRenderer.php` |
| Guards | `config/auth.php` (`ebudget`, `engas`, `sims`) |
| Token lifetime, rate limits | `config/api.php`, `app/Providers/AppServiceProvider.php` |
| CORS | `config/cors.php` |
| Permissions, built-in roles | `app/Enums/Permission.php`, `app/Enums/SystemRole.php` |

## Authentication mechanism

- **Expiring bearer tokens per system**, stored in that system's database
  (custom `system-{key}` guards, Sanctum-style `createToken`). Not Sanctum SPA
  cookies, not JWT, not Passport, no sessions.
- The API is stateless: no cookies, sessions or CSRF in the `api` group
  (`bootstrap/app.php`), and CORS has `supports_credentials: false`.
- Each system (`ebudget`, `engas`, `sims`) has its own users, roles, tokens and
  routes. A token only works on the system that issued it. This frontend uses
  **`ebudget`** (`BACKEND_SYSTEM`).
- Token lifetime: `API_TOKEN_TTL_MINUTES`, default 720 (12 hours). There is
  **no refresh token** and no refresh endpoint: when the token expires the user
  signs in again.
- `CORS_ALLOWED_ORIGINS` is empty in the backend's `.env`, so a browser cannot
  call the API cross-origin.

## How the frontend uses it

```
Browser ──(httpOnly cookie, same origin)──▶ Next.js /api/auth/* ──(Authorization: Bearer)──▶ backend /api/v1/ebudget/auth/*
```

The browser never calls the backend's auth endpoints directly. Three Next.js
route handlers (`src/app/api/auth/{login,me,logout}/route.ts`, helpers in
`src/lib/server/backend-auth.ts`) call the backend on the server:

- After login the access token is stored **only** in the `ebudget_session`
  cookie: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production. It is
  never returned in a response body, never put in Redux, localStorage,
  sessionStorage or logs, and never readable by scripts.
- "Remember me" (frontend-only) decides whether the cookie lasts until the
  token's `expires_at` or only for the browser session. The backend token
  lifetime is the same either way.
- `middleware.ts` redirects on the cookie's presence (UX only). `AppShell`
  then loads the user with `GET /auth/me` and shows a loading screen until it
  is known, so protected content never flashes.
- CSRF: the proxy is cookie-authenticated, so `POST` login/logout require a
  same-origin `Origin` / `Sec-Fetch-Site` and the `X-Requested-With:
  XMLHttpRequest` header the API client always sends.
- The proxy forwards `X-Forwarded-For` so the backend's rate limits apply per
  browser. The backend only trusts that header from private networks.

## Endpoints

All backend paths are relative to `BACKEND_API_URL`
(default `http://localhost:8080/api/v1`). Browser paths are same-origin.

### Login

| | |
| --- | --- |
| Backend | `POST /api/v1/ebudget/auth/login` (route `api.v1.ebudget.auth.login`) |
| Browser | `POST /api/auth/login` |
| Auth | None. Throttled by `throttle:auth`: 5/min per email+IP+system, 20/min per IP. |
| Frontend method | `authService.login` → RTK Query `useLoginMutation` (`src/features/auth/services/authApi.ts`) |

Request (backend, `LoginRequest`):

| Field | Rules |
| --- | --- |
| `email` | required, string, `email:rfc`, max 255. Trimmed and lowercased by the backend. |
| `password` | required, string, max 255 |
| `device_name` | optional, string, max 64, `[letters digits space . _ -]`. Default `api`. The proxy sends `ebudget-web`. |

Browser request body: `{ "email", "password", "remember": boolean }`. Only
`email`, `password` and `device_name` are sent to the backend.

Backend response `200`:

```json
{
  "token_type": "Bearer",
  "access_token": "<id>|<plain text token>",
  "expires_at": "2026-11-12T14:30:00+00:00",
  "user": { "...CurrentSystemUser (below)" }
}
```

Browser response `200` (token moved into the cookie):

```json
{ "user": { "...CurrentSystemUser" }, "expiresAt": "2026-11-12T14:30:00.000Z" }
```

Errors:

| Status | When | Body |
| --- | --- | --- |
| 422 `validation_failed` | Unknown email, wrong password **or inactive account** (same message for all three, with constant-time hashing), or invalid input | `errors.email: ["These credentials do not match our records."]` or per-field rules |
| 429 `too_many_requests` | Rate limit hit | `Retry-After` header (forwarded) |
| 503 `backend_unavailable` / 504 `backend_timeout` | Proxy could not reach the backend | Produced by the proxy |

### Current user

| | |
| --- | --- |
| Backend | `GET /api/v1/ebudget/auth/me` (`auth:ebudget`) |
| Browser | `GET /api/auth/me` |
| Auth | `Authorization: Bearer <token>` (the proxy reads it from the cookie) |
| Frontend method | `authService.me` → `useGetCurrentUserQuery`, called by `AppShell` on every load |

Response `200` (a JsonResource, so wrapped in `data`; the API client unwraps it):

```json
{
  "data": {
    "id": "01JC…",
    "name": "Ana Villanueva",
    "email": "ana@mpc.edu.ph",
    "is_active": true,
    "system": { "key": "ebudget", "name": "eBudget" },
    "roles": [{ "id": "01JC…", "key": "admin", "name": "Admin" }],
    "last_login_at": "2026-11-12T02:30:00+00:00",
    "created_at": "2026-11-01T00:00:00+00:00",
    "is_super_admin": false,
    "permissions": ["users.view", "users.create", "roles.view"]
  }
}
```

Type: `User` in `src/features/auth/types/index.ts`. `roles[].key` is
`super_admin`, `admin` or `null` for custom roles.

Errors: `401 unauthenticated` (no, expired, revoked or other-system token).
On 401 the proxy also clears the cookie, so the route guard cannot loop
between `/login` and `/dashboard`.

### Logout

| | |
| --- | --- |
| Backend | `POST /api/v1/ebudget/auth/logout` (`auth:ebudget`) |
| Browser | `POST /api/auth/logout` |
| Auth | Bearer token (from the cookie) |
| Frontend method | `authService.logout` → `useLogoutMutation`, wrapped by `useLogout()` |

Backend response `204 No Content`; it deletes the current token only (other
devices stay signed in). The proxy always clears the cookie: on 204, on 401
(already expired) and when the backend is unreachable (then it answers 503 and
the token expires at its `expires_at`). `useLogout` then resets the auth,
filter and wizard state and the RTK Query cache and goes to `/login`.

## Error format

Every backend error is RFC 9457 problem details (`application/problem+json`):

```json
{ "type": "about:blank", "title": "Unprocessable Content", "status": 422,
  "code": "validation_failed", "detail": "The given data was invalid.",
  "request_id": "…", "errors": { "email": ["…"] } }
```

`errorFromResponse` (`src/lib/api/api-error.ts`) uses `detail` as the message
and the first message of each `errors` field. 5xx messages are replaced by a
generic text, so internals never reach the user. Statuses used here: 401
`unauthenticated`, 403 `forbidden`, 404, 422, 429, 500 `server_error`.

## Roles and permissions

`GET /auth/me` returns effective `permissions` (super admins have all). The
backend checks every request itself with `can:<permission>` middleware; the
frontend uses them only to show or hide UI (`hasPermission` in
`src/features/auth/utils`, `selectHasPermission`, `NavItem.permission`).

Catalog (`app/Enums/Permission.php`): `users.view`, `users.create`,
`users.deactivate`, `roles.view`, `roles.manage`, `roles.assign`,
`reports.view`, `reports.share`. Built-in roles: `super_admin`, `admin` (both
get every permission). None of these map to the current eBudget pages yet, so
no navigation item is hidden today.

## Not provided by the backend

These are documented, not implemented or simulated, in real auth mode:

- **Forgot password / reset password**: no endpoints, `config/auth.php` has
  `'passwords' => []`. The pages show "contact your administrator".
- **Registration**: no endpoint. Users are created by an admin
  (`POST /users`, permission `users.create`) or the `CreateSystemUserCommand`
  artisan command.
- **Profile update / change password**: no endpoints. The profile page shows
  `GET /auth/me` read-only.
- **Refresh tokens**: none. An expired token means signing in again.
- **eBudget data endpoints** (appropriations, allotments, obligations, BFARS…):
  not in the backend yet. Use `NEXT_PUBLIC_API_MODE=mock` with
  `NEXT_PUBLIC_AUTH_MODE=real`.

## Configuration

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_AUTH_MODE` | browser | `NEXT_PUBLIC_API_MODE` | `real` = backend through the proxy, `mock` = demo accounts |
| `BACKEND_API_URL` | server only | `http://localhost:8080/api/v1` | Backend API root |
| `BACKEND_SYSTEM` | server only | `ebudget` | `ebudget`, `engas` or `sims` |
| `BACKEND_TIMEOUT_MS` | server only | `15000` | Proxy → backend timeout |
| `SESSION_COOKIE_INSECURE` | server only | `false` | `true` drops `Secure` to test a production build over http |

The backend must be reachable from the Next.js server (not the browser), so
its CORS settings do not need to change.

## Frontend files

| File | Role |
| --- | --- |
| `src/app/api/auth/{login,me,logout}/route.ts` | Auth proxy route handlers |
| `src/lib/server/backend-auth.ts` | Server-only backend calls, cookie, CSRF checks |
| `src/lib/api/api-client.ts` | Single HTTP client; `/auth/*` follows `authMode` |
| `src/services/auth.service.ts` | Auth service methods |
| `src/features/auth/services/authApi.ts` | RTK Query endpoints |
| `src/store/slices/authSlice.ts` | `status`, `user`, `isLoading`, `error` + selectors |
| `src/features/auth/types`, `src/features/auth/utils` | Types and role/permission helpers |
| `src/middleware.ts`, `src/components/layout/AppShell.tsx` | Route protection |
| `tests/auth-proxy.test.ts` | Proxy tests with backend-format responses |

## Verification status

See the bottom of this file, updated after each check against the running
backend.

- Unit tests (`npm test`): login, cookie handling, 422 / 429 / 401 / 503,
  CSRF rejection, logout and `/me` against stubbed backend responses in the
  real formats.
- Production build: route redirects (`/` → `/login`, protected route keeps
  `?next=`, signed-in visitor on `/login` → `/dashboard`) and "backend
  unavailable" (503) checked with the backend stopped.
- **Live backend (2026-11-12): verified** through the Next.js dev server
  against the running backend (`make up` on port 8080, after `make install`,
  `make key`, `make migrate` and `system:create-user ebudget … --role=super_admin`):
  wrong password → 422 "These credentials do not match our records."; login →
  user with `super_admin` role and httpOnly cookie; `/auth/me` and
  `/dashboard` → 200; logout → 204; the revoked token → 401 and the cookie
  is cleared.
