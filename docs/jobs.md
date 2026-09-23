# Jobs (API)

Companion to web: **[web/docs/jobs.md](../../web/docs/jobs.md)** · feature inventory: **[docs/features/jobs.md](../../docs/features/jobs.md)**.

## Mounts

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/jobs` | List / create |
| GET/PATCH/DELETE | `/api/jobs/:id` | Detail / update (nested replace) / delete |
| PATCH | `/api/jobs/:id/checklist/:itemId` | Toggle/edit one checklist item |
| PATCH | `/api/jobs/:id/deliverables/:deliverableId` | Status / URL / title |
| GET | `/api/jobs/:id/activity` | Activity log (`job_activity`) |
| GET | `/api/quotations?jobId=` | Source quote + add-ons for a job |
| * | `/api/money/invoices\|payments\|expenses?jobId=` | Job money |

## Schema / migration

- `quotations.job_id` — nullable FK to jobs (add-on / follow-up quotes). Source convert still uses `jobs.quotation_id`.
- `job_activity` — channel `EMAIL|WHATSAPP|NOTE`, kind, subject, summary, optional `invoice_id`.
- Migration: `drizzle/migrations/0007_job_detail_addons.sql`

## Nested `PATCH /api/jobs/:id`

Sending `sessions`, `checklistItems`, `deliverables`, or `contracts` **replaces** that collection (sessions include `crew[]`: studioMemberId and/or crewContactId + crewRoleItemId).

## Activity writers

Invoice share service logs:

- email send → `INVOICE_EMAIL` / `EMAIL`
- WhatsApp share-message → `INVOICE_WA` / `WHATSAPP`
