import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/database.js";
import { studios } from "../db/schema/studios.js";
import { clients } from "../db/schema/clients.js";
import { jobs } from "../db/schema/jobs.js";
import { invoiceMilestones, invoices, payments } from "../db/schema/money.js";
import { env } from "../config/env.js";
import { isSmtpConfigured, sendMail } from "../lib/mailer.js";
import { buildInvoicePdf } from "../lib/pdf-documents.js";
import {
  clientValues,
  formatDueDate,
  formatMoney,
  renderTemplate,
  studioValues,
  whatsappUrl,
} from "../lib/message-templates.js";
import { MoneyServiceError } from "./money.service.js";
import { issuePortalToken, resolvePortalToken } from "./portal.service.js";
import {
  getEmailTemplate,
  getWhatsappTemplate,
} from "./settings-templates.service.js";

const FALLBACK_EMAIL_SUBJECT = "Invoice {invoice_number} from {studio}";
const FALLBACK_EMAIL_BODY =
  "Hello {client},\n\nHere is invoice {invoice_number} from {studio}. Balance due {balance} of {amount}. You can view it and your payment schedule online:\n{link}";
const FALLBACK_WHATSAPP_BODY =
  "Hello {client},\n\nInvoice {invoice_number} from {studio} — balance due {balance}:\n{link}";

function money(amount: string) {
  const value = Number(amount);
  return Number.isFinite(value) ? value : 0;
}

/** Invoice + its job, client and studio branding in one shot. */
async function loadInvoiceContext(studioId: number, invoiceId: number) {
  const rows = await db
    .select({
      invoice: invoices,
      jobId: jobs.id,
      jobNumber: jobs.number,
      clientId: clients.id,
      clientName: clients.name,
      clientPhone: clients.phone,
      clientEmail: clients.email,
      studioName: studios.name,
      studioAddress: studios.address,
      studioPhone: studios.phone,
      studioEmail: studios.email,
      studioSsm: studios.ssm,
      currency: studios.currency,
    })
    .from(invoices)
    .innerJoin(jobs, eq(invoices.jobId, jobs.id))
    .innerJoin(clients, eq(jobs.clientId, clients.id))
    .innerJoin(studios, eq(invoices.studioId, studios.id))
    .where(and(eq(invoices.id, invoiceId), eq(invoices.studioId, studioId)))
    .limit(1);

  const row = rows[0];
  if (!row) throw new MoneyServiceError("Invoice not found.", 404);

  const milestones = await db
    .select()
    .from(invoiceMilestones)
    .where(eq(invoiceMilestones.invoiceId, invoiceId))
    .orderBy(asc(invoiceMilestones.sortOrder), asc(invoiceMilestones.id));

  const milestoneIds = milestones.map((milestone) => milestone.id);
  const paidRows =
    milestoneIds.length === 0
      ? []
      : await db
          .select()
          .from(payments)
          .where(
            and(
              inArray(payments.milestoneId, milestoneIds),
              eq(payments.status, "PAID"),
            ),
          );

  const paidMilestoneIds = new Set(
    paidRows
      .map((payment) => payment.milestoneId)
      .filter((id): id is number => id !== null),
  );

  const total = milestones.reduce((sum, m) => sum + money(m.amount), 0);
  const paid = paidRows.reduce((sum, p) => sum + money(p.amount), 0);

  return {
    invoice: row.invoice,
    job: { id: row.jobId, number: row.jobNumber },
    client: {
      id: row.clientId,
      name: row.clientName,
      phone: row.clientPhone,
      email: row.clientEmail,
    },
    studio: {
      name: row.studioName,
      address: row.studioAddress,
      phone: row.studioPhone,
      email: row.studioEmail,
      ssm: row.studioSsm,
    },
    currency: row.currency,
    milestones: milestones.map((milestone) => ({
      ...milestone,
      paid: paidMilestoneIds.has(milestone.id),
    })),
    totals: {
      total: total.toFixed(2),
      paid: paid.toFixed(2),
      balance: Math.max(total - paid, 0).toFixed(2),
    },
  };
}

type InvoiceContext = Awaited<ReturnType<typeof loadInvoiceContext>>;

function portalInvoiceLink(token: string) {
  return `${env.PUBLIC_WEB_ORIGIN.replace(/\/$/, "")}/portal/${token}?tab=invoice`;
}

function invoiceValues(context: InvoiceContext, link: string) {
  return {
    ...studioValues(context.studio),
    ...clientValues(context.client),
    link,
    invoice_number: context.invoice.number ?? `#${context.invoice.id}`,
    job_number: context.job.number ?? `#${context.job.id}`,
    amount: formatMoney(context.totals.total, context.currency),
    total: formatMoney(context.totals.total, context.currency),
    paid: formatMoney(context.totals.paid, context.currency),
    balance: formatMoney(context.totals.balance, context.currency),
    currency: context.currency,
    milestone: context.milestones[0]?.label ?? "",
    due_date: formatDueDate(context.milestones[0]?.dueDate ?? null),
  };
}

function withLink(body: string, link: string) {
  return body.includes(link) ? body : `${body.trimEnd()}\n\n${link}`;
}

/** Sending an invoice moves a draft to SENT; PAID / VOID are left alone. */
async function markInvoiceSent(studioId: number, context: InvoiceContext) {
  if (context.invoice.status !== "DRAFT") return context.invoice.status;
  await db
    .update(invoices)
    .set({ status: "SENT" })
    .where(
      and(eq(invoices.id, context.invoice.id), eq(invoices.studioId, studioId)),
    );
  return "SENT" as const;
}

export async function buildInvoiceShareMessage(
  studioId: number,
  invoiceId: number,
  options: { markSent?: boolean; channel?: "whatsapp" | "email" } = {},
) {
  const context = await loadInvoiceContext(studioId, invoiceId);
  const { token } = await issuePortalToken(studioId, context.job.id);
  const link = portalInvoiceLink(token);
  const channel = options.channel ?? "whatsapp";
  const values = invoiceValues(context, link);

  let text: string;
  let subject: string | undefined;

  if (channel === "email") {
    const template = await getEmailTemplate(studioId, "INVOICE");
    subject = renderTemplate(template?.subject ?? FALLBACK_EMAIL_SUBJECT, values);
    text = withLink(
      renderTemplate(template?.body ?? FALLBACK_EMAIL_BODY, values),
      link,
    );
  } else {
    const template = await getWhatsappTemplate(studioId, "INVOICE");
    text = withLink(
      renderTemplate(template?.body ?? FALLBACK_WHATSAPP_BODY, values),
      link,
    );
  }

  const status =
    options.markSent === true
      ? await markInvoiceSent(studioId, context)
      : context.invoice.status;

  return {
    invoiceId: context.invoice.id,
    number: context.invoice.number,
    channel,
    link,
    token,
    text,
    ...(subject !== undefined ? { subject } : {}),
    waUrl: whatsappUrl(context.client.phone, text),
    status,
  };
}

export async function sendInvoiceEmail(
  studioId: number,
  invoiceId: number,
  input: { to?: string; attachPdf?: boolean; markSent?: boolean } = {},
) {
  const context = await loadInvoiceContext(studioId, invoiceId);
  const to = (input.to ?? context.client.email ?? "").trim();

  if (!to) {
    throw new MoneyServiceError(
      "This client has no email address. Add one or pass `to`.",
      400,
    );
  }

  if (!isSmtpConfigured()) {
    throw new MoneyServiceError(
      "Email sending is not configured on this server.",
      503,
    );
  }

  const { token } = await issuePortalToken(studioId, context.job.id);
  const link = portalInvoiceLink(token);
  const values = invoiceValues(context, link);

  const template = await getEmailTemplate(studioId, "INVOICE");
  const subject = renderTemplate(
    template?.subject ?? FALLBACK_EMAIL_SUBJECT,
    values,
  );
  const text = withLink(
    renderTemplate(template?.body ?? FALLBACK_EMAIL_BODY, values),
    link,
  );

  const attachments =
    input.attachPdf === true
      ? [
          {
            filename: invoicePdfFilename(context),
            content: await renderInvoicePdf(context),
            contentType: "application/pdf",
          },
        ]
      : undefined;

  const result = await sendMail({
    to,
    subject,
    text,
    ...(attachments !== undefined ? { attachments } : {}),
  });

  const status =
    input.markSent === true
      ? await markInvoiceSent(studioId, context)
      : context.invoice.status;

  return {
    invoiceId: context.invoice.id,
    number: context.invoice.number,
    to,
    subject,
    link,
    attachedPdf: input.attachPdf === true,
    messageId: result.messageId,
    status,
  };
}

function invoicePdfFilename(context: InvoiceContext) {
  return `${context.invoice.number ?? `invoice-${context.invoice.id}`}.pdf`;
}

async function renderInvoicePdf(context: InvoiceContext) {
  return buildInvoicePdf({
    studio: context.studio,
    client: context.client,
    number: context.invoice.number ?? `INV-${context.invoice.id}`,
    currency: context.currency,
    issuedAt: context.invoice.createdAt,
    status: context.invoice.status,
    notes: context.invoice.notes,
    milestones: context.milestones.map((milestone) => ({
      label: milestone.label,
      amount: milestone.amount,
      dueDate: formatDueDate(milestone.dueDate),
      paid: milestone.paid,
    })),
    totalAmount: context.totals.total,
    paidAmount: context.totals.paid,
    balanceAmount: context.totals.balance,
  });
}

export async function getInvoicePdf(studioId: number, invoiceId: number) {
  const context = await loadInvoiceContext(studioId, invoiceId);
  return {
    filename: invoicePdfFilename(context),
    buffer: await renderInvoicePdf(context),
  };
}

/** Client portal download — the portal token must own the invoice's job. */
export async function getPortalInvoicePdf(token: string, invoiceId: number) {
  const portal = await resolvePortalToken(token);
  const context = await loadInvoiceContext(portal.studioId, invoiceId);

  if (context.job.id !== portal.jobId) {
    throw new MoneyServiceError("Invoice not found.", 404);
  }

  return {
    filename: invoicePdfFilename(context),
    buffer: await renderInvoicePdf(context),
  };
}
