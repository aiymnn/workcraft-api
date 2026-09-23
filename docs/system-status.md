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
| Quotes + public quote | `/api/quotations`, `/api/public/quotations` (`?jobId=` = source + add-ons; `quotations.job_id`) |
| Jobs + activity + calendar | `/api/jobs`, `GET /api/jobs/:id/activity`, `/api/calendar` |
| Money + portal + CHIP webhook | `/api/money`, `/api/portal`, `/api/webhooks/chip` |

### Job detail API notes (shipped)

- Nested job `PATCH` replaces sessions (incl. crew), checklist, deliverables, contracts when those arrays are sent.
- Add-on quotations: optional `jobId` on create/update; list filter returns add-ons **or** job’s source `jobs.quotation_id`.
- `job_activity`: written on invoice email (`INVOICE_EMAIL`) and WhatsApp share (`INVOICE_WA`); migration `0007_job_detail_addons`.
- Granular: `PATCH /api/jobs/:id/checklist/:itemId`, `PATCH /api/jobs/:id/deliverables/:deliverableId`.
| Dashboard + pricing | `/api/dashboard`, `/api/pricing` |
| Equipment + logo | `/api/equipment`, `POST /api/settings/studio/logo` |
