# Feedback Service — Implementation Plan

A self-hosted feedback collection service: embedded iframe widget, single SQLite database,
per-service grouping, admin dashboard, webhook notifications.

## Decisions

- **Database**: SQLite + Drizzle ORM (`better-sqlite3`), DB file at `./data/feedback.db`
- **Screenshot storage**: local filesystem under `./screenshots/`, path referenced in DB
- **Admin auth**: single password from env var, signed HttpOnly session cookie
- **Deployment**: self-hosted Node server / Docker (filesystem + in-memory rate limiting OK),
  optional `NEXT_PUBLIC_BASE_PATH` sub-path baked in at build time

## Stack

- Next.js 16 App Router, React 19, Tailwind 4, TypeScript (already present)
- `drizzle-orm`, `better-sqlite3`, `drizzle-kit` (migrations), `zod` (validation)
- `vitest` for tests (TDD)

## Schema

```ts
services: id (pk), name, slug (unique), embedKey (unique), webhookUrl (nullable),
          webhookFormat ('generic'|'microsoft-teams', default 'generic'),
          acceptingReports (bool, default true), acceptingScreenshots (bool, default true),
          createdAt
feedback: id (pk), serviceId (FK -> services), message, email?, screenshotPath?,
          pageUrl?, userAgent?, status ('new'|'read'|'archived', default 'new'), createdAt
          index (serviceId, status, createdAt)
notification_log: id, feedbackId (FK), webhookUrl, ok, responseStatus?, error?, attemptedAt
```

## Phases

1. **Foundation** — deps, db schema + client, drizzle config, seed.
2. **Public API** — `POST /api/feedback` (multipart): validate embed key, message <= 5000 chars,
   optional email, optional screenshot (image/*, <= 5 MB) stored under
   `screenshots/<slug>/<uuid>.<ext>`; insert row; fire webhook; rate limit (token bucket,
   key + IP). `GET/POST /embed` page: standalone minimal form in route group, key from `?k=`.
   Security headers: only `/embed` is frameable.
3. **Admin auth** — `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET` env, constant-time compare,
   HMAC-signed session cookie, `proxy.ts` guards `/admin/*`, login/logout routes.
4. **Notifications** — `lib/notify.ts`: JSON payload POST to `services.webhookUrl` with
   timeout, one retry, every attempt logged in `notification_log`. Best-effort.
5. **Admin dashboard** — server components + server actions:
   - `/admin` overview: service cards with unread counts
   - `/admin/[slug]` inbox: status filter tabs, pagination
   - `/admin/[slug]/[id]` detail: full message, screenshot via authenticated streaming route
   - `/admin/[slug]/settings`: name, webhook URL + test button, regenerate embed key,
     iframe snippet
   - create new service
6. **Polish** — README (env vars, embed snippet, webhook payload, backups), Dockerfile +
   docker-compose.yml with bind mounts for `data/` and `screenshots/`, lint + build green.

## Trade-offs

- Webhook delivery is best-effort (log + 1 retry) — revisit with a queue if missed alerts matter.
- Rate limiting is per-instance memory — fine for single replica.
- Single-operator assumption: one shared admin password, no per-user accounts.

## Build order

Phases in order; each leaves the app buildable and testable. Tests written first per unit.
