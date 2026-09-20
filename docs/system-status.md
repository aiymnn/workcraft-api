# System status (API)

Canonical debug map lives in the workspace root:

**[docs/system-status.md](../../docs/system-status.md)**

Route tables: **[docs/architecture/api.md](../../docs/architecture/api.md)**  
OpenAPI: [openapi.yaml](./openapi.yaml) (served at `/api-docs`)

## Quick slice index

| Slice | Mount |
|-------|--------|
| Auth + clients + settings core | `/api/auth`, `/api/clients`, `/api/settings` |
| Team + account | `/api/team`, `/api/account` |
| Quotes + public quote | `/api/quotations`, `/api/public/quotations` |
| Jobs + calendar | `/api/jobs`, `/api/calendar` |
| Money + portal + CHIP webhook | `/api/money`, `/api/portal`, `/api/webhooks/chip` |
| Dashboard + pricing | `/api/dashboard`, `/api/pricing` |
| Equipment + logo | `/api/equipment`, `POST /api/settings/studio/logo` |
