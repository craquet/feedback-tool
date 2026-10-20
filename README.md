# Feedback Service

Self-hosted feedback collection for multiple services. Users submit feedback through a small
embedded iframe (message, optional email, optional screenshot). Reports land in a single
SQLite database, grouped by service, visible in a password-protected admin dashboard.
Incoming reports can trigger a JSON webhook (e.g. Microsoft Teams) per service.

## Stack

- Next.js 16 (App Router), React 19, Tailwind 4
- shadcn/ui (Base UI primitives) + lucide-react icons
- SQLite via Drizzle ORM (`better-sqlite3`)
- Tests: Vitest (`npm test`)

## Setup

### Node

```sh
npm install
cp .env.example .env   # then edit values
npm run build && npm start
```

### Docker

```sh
cp .env.example .env   # then edit values
docker compose up --build -d
```

The SQLite database and uploaded screenshots are bind-mounted to the local
`./data` and `./screenshots` directories (see `docker-compose.yml`), so they
survive container rebuilds and can be backed up directly from the host. On
first start on Linux, Docker creates these directories owned by root — run
`mkdir -p data screenshots` beforehand if you want to keep your own ownership.

On first start the database schema is applied automatically. Create your first service via
the dashboard at `/admin` (you will be asked for `ADMIN_PASSWORD`).

### Environment variables

| Variable | Purpose |
|---|---|
| `DB_PATH` | SQLite file location (default `data/feedback.db`) |
| `SCREENSHOTS_DIR` | Where uploaded screenshots are stored (default `screenshots/`) |
| `ADMIN_PASSWORD` | Password for the admin dashboard (required) |
| `ADMIN_SESSION_SECRET` | Random string used to sign admin session cookies (required) |
| `ADMIN_BASE_URL` | Public base URL, used for links inside webhook payloads and in the embed snippet |

## Embedding

Create a service in the dashboard, open its **Settings** page and copy a snippet
in your flavor: plain HTML, React, Vue, Svelte, or just the bare embed URL.
The plain HTML version:

```html
<iframe src="https://feedback.example.com/embed?k=fb_<key>" style="width:100%;max-width:480px;height:460px;border:0" title="Feedback"></iframe>
```

Only the `/embed` page may be framed; all other pages send `frame-ancestors 'none'`.

## HTTP API

| Endpoint | Description |
|---|---|
| `POST /api/feedback` | Public. `multipart/form-data`: `embedKey`, `message` (required), `email`, `screenshot` (image ≤ 5 MB), `pageUrl`. Rate limited. |
| `GET /embed?k=<key>` | Public. The embeddable form page. |
| `POST /api/admin/login` | Admin login (JSON `{ password }`), sets a signed session cookie. |
| `POST /api/admin/logout` | Clears the session. |
| `GET /api/admin/feedback/:id/screenshot` | Serves an attached screenshot (admin session required). |
| `POST /api/admin/services/:id/test-webhook` | Sends a test payload to a webhook URL (admin session required). |
| `GET /api/admin/services/:id/export` | Downloads all feedback of the service as CSV (admin session required). Add `?ids=1,2,3` to export only those reports. |

Per-service toggles on the Settings page affect `POST /api/feedback`: if the
service is set to not accept reports it returns `403`; if screenshots are
disabled a submission including a screenshot returns `400`.

Reports can be deleted from the inbox or the detail view (with a confirmation
dialog); deletion also removes the attached screenshot from disk. The inbox
also supports multi-select bulk actions: mark read/unread, archive, delete,
and CSV export of the selected reports.

## Webhook payload

Each service has a webhook format setting (Settings → Webhook format).

**Generic JSON** (default) — for each new report with a configured webhook URL:

```json
{
  "serviceName": "My Web App",
  "feedbackId": 42,
  "message": "The export button does nothing",
  "email": "user@example.com",
  "pageUrl": "https://app.example.com/reports",
  "hasScreenshot": true,
  "createdAt": "2026-10-16T12:00:00.000Z",
  "adminUrl": "https://feedback.example.com/admin/my-web-app/42"
}
```

**Microsoft Teams** — for webhooks that post directly into a Teams channel
(e.g. a Power Automate flow with only a "Post card in a chat or channel"
action). The body is a `message` with an Adaptive Card attachment containing
the report title, message text, email/page facts and an "Open in admin" link.
The card also carries a single-line `summary` (service name + message, ≤ 140
chars) so Teams shows the report text as the notification preview instead of
"no preview available".

Delivery is best-effort: 5 s timeout, one retry, every attempt logged in the
`notification_log` table. Use "Send test" on the settings page to verify integration.

## Development

```sh
npm test          # run tests once
npm run test:watch
npm run db:generate  # regenerate SQL migrations after editing db/schema.ts
```

## Operations notes

- **Backups**: back up the SQLite database (`data/`) and the screenshots directory
  (`screenshots/`). The schema is applied idempotently on startup.
- **Docker**: `docker compose up --build -d` (see `docker-compose.yml`); the SQLite
  database and screenshots are bind-mounted to `./data` and `./screenshots`.
- Rate limiting is in-memory and per instance — adequate for a single server.
- Webhook delivery is best-effort; a persistent queue would be needed for guaranteed delivery.
