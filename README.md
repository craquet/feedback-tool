# Feedback Service

Self-hosted feedback collection for multiple services. Users submit feedback through a small
embedded iframe (message, optional email, optional screenshot). Reports land in a single
SQLite database, grouped by service, visible in a password-protected admin dashboard.
Incoming reports can trigger a JSON webhook (e.g. Microsoft Teams) per service.

## Stack

- Next.js 16 (App Router), React 19, Tailwind 4
- SQLite via Drizzle ORM (`better-sqlite3`)
- Tests: Vitest (`npm test`)

## Setup

```sh
npm install
cp .env.example .env   # then edit values
npm run build && npm start
```

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

Create a service in the dashboard, open its **Settings** page and copy the iframe snippet:

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

## Webhook payload

For each new report with a configured webhook URL:

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
- **Docker**: see `Dockerfile`; mount volumes for `/app/data` and `/app/screenshots`.
- Rate limiting is in-memory and per instance — adequate for a single server.
- Webhook delivery is best-effort; a persistent queue would be needed for guaranteed delivery.
