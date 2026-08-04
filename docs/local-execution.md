# Local execution

```bash
pnpm install
pnpm dev:gateway
pnpm dev
```

The browser starts in mock mode. Select “Local gateway · real keys” only after the gateway is running and the relevant key is present in `.env`.

The gateway exposes:

```text
GET  /health
GET  /ready
GET  /api/providers
GET  /api/models
POST /api/compatibility
POST /api/experiments
GET  /api/experiments/:id
POST /api/runs
POST /api/runs/stream
POST /api/runs/:id/cancel
POST /api/import
POST /api/export
```

Use `docker compose up --build` for a containerized local run. The compose file binds the gateway to localhost and does not copy `.env` into the image.
