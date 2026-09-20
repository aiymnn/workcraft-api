import { and, eq } from "drizzle-orm";
import { db } from "../db/database.js";
import { studios } from "../db/schema/studios.js";
import { quotations } from "../db/schema/quotations.js";
import { env } from "../config/env.js";
import { isSmtpConfigured, sendMail } from "../lib/mailer.js";
import { buildQuotationPdf } from "../lib/pdf-documents.js";
import {
  clientValues,
  formatMoney,
  renderTemplate,
  studioValues,
  whatsappUrl,
} from "../lib/message-templates.js";
import {
  QuotationServiceError,
  getQuotation,
  issueQuotationBookingLink,
} from "./quotation.service.js";
import {
  getEmailTemplate,
  getWhatsappTemplate,
} from "./settings-templates.service.js";

const FALLBACK_EMAIL_SUBJECT = "Your quotation {quote_number} from {studio}";
const FALLBACK_EMAIL_BODY =
  "Hello {client},\n\nThank you for considering {studio}. Your quotation {quote_number} for {amount} is ready — you can view it, read the agreement and accept it online:\n{link}";
const FALLBACK_WHATSAPP_BODY =
  "Hello {client},\n\nThank you for considering {studio}. Your quotation {quote_number} ({amount}) is ready:\n{link}";

type QuotationDetail = NonNullable<Awaited<ReturnType<typeof getQuotation>>>;

async function loadStudio(studioId: number) {
  const rows = await db
    .select({
      id: studios.id,
      name: studios.name,
      address: studios.address,
      phone: studios.phone,
      email: studios.email,
      ssm: studios.ssm,
      currency: studios.currency,
    })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);

  const studio = rows[0];
  if (!studio) throw new QuotationServiceError("Studio not found.", 404);
  return studio;
}

async function loadQuotation(studioId: number, id: number) {
  const quotation = await getQuotation(studioId, id);
  if (!quotation) {
    throw new QuotationServiceError("Quotation not found.", 404);
  }
  return quotation;
}

/** Sending or sharing moves a draft forward; later statuses are left alone. */
async function markQuotationSent(studioId: number, quotation: QuotationDetail) {
  if (quotation.status !== "DRAFT") return quotation.status;
  await db
    .update(quotations)
    .set({ status: "SENT" })
    .where(
      and(eq(quotations.id, quotation.id), eq(quotations.studioId, studioId)),
    );
  return "SENT" as const;
}

function publicQuoteLink(token: string) {
  return `${env.PUBLIC_WEB_ORIGIN.replace(/\/$/, "")}/quote/${token}`;
}

function quotationValues(
  quotation: QuotationDetail,
  studio: { name: string; email: string | null; phone: string | null },
  link: string,
) {
  return {
    ...studioValues(studio),
    ...clientValues({
      name: quotation.client?.name ?? "there",
      email: quotation.client?.email ?? null,
      phone: quotation.client?.phone ?? null,
    }),
    link,
    quote_number: quotation.number ?? `#${quotation.id}`,
    amount: formatMoney(quotation.totalAmount, quotation.currency),
    total: formatMoney(quotation.totalAmount, quotation.currency),
    currency: quotation.currency,
  };
}

/** Keep the client link in the message even when a studio template drops it. */
function withLink(body: string, link: string) {
  return body.includes(link) ? body : `${body.trimEnd()}\n\n${link}`;
}

export async function buildQuotationShareMessage(
  studioId: number,
  id: number,
  options: { markSent?: boolean; channel?: "whatsapp" | "email" } = {},
) {
  const quotation = await loadQuotation(studioId, id);
  const studio = await loadStudio(studioId);
  const { token } = await issueQuotationBookingLink(studioId, id);
  const link = publicQuoteLink(token);
  const channel = options.channel ?? "whatsapp";
  const values = quotationValues(quotation, studio, link);

  let text: string;
  let subject: string | undefined;

  if (channel === "email") {
    const template = await getEmailTemplate(studioId, "QUOTE");
    subject = renderTemplate(template?.subject ?? FALLBACK_EMAIL_SUBJECT, values);
    text = withLink(
      renderTemplate(template?.body ?? FALLBACK_EMAIL_BODY, values),
      link,
    );
  } else {
    const template = await getWhatsappTemplate(studioId, "QUOTE");
    text = withLink(
      renderTemplate(template?.body ?? FALLBACK_WHATSAPP_BODY, values),
      link,
    );
  }

  const status =
    options.markSent === true
      ? await markQuotationSent(studioId, quotation)
      : quotation.status;

  return {
    quotationId: quotation.id,
    number: quotation.number,
    channel,
    link,
    token,
    text,
    ...(subject !== undefined ? { subject } : {}),
    waUrl: whatsappUrl(quotation.client?.phone ?? null, text),
    status,
  };
}

export async function sendQuotationEmail(
  studioId: number,
  id: number,
  input: { to?: string; attachPdf?: boolean; markSent?: boolean } = {},
) {
  const quotation = await loadQuotation(studioId, id);
  const to = (input.to ?? quotation.client?.email ?? "").trim();

  if (!to) {
    throw new QuotationServiceError(
      "This client has no email address. Add one or pass `to`.",
      400,
    );
  }

  if (!isSmtpConfigured()) {
    throw new QuotationServiceError(
      "Email sending is not configured on this server.",
      503,
    );
  }

  const studio = await loadStudio(studioId);
  const { token } = await issueQuotationBookingLink(studioId, id);
  const link = publicQuoteLink(token);
  const values = quotationValues(quotation, studio, link);

  const template = await getEmailTemplate(studioId, "QUOTE");
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
            filename: quotationPdfFilename(quotation),
            content: await renderQuotationPdf(studio, quotation),
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
      ? await markQuotationSent(studioId, quotation)
      : quotation.status;

  return {
    quotationId: quotation.id,
    number: quotation.number,
    to,
    subject,
    link,
    attachedPdf: input.attachPdf === true,
    messageId: result.messageId,
    status,
  };
}

function quotationPdfFilename(quotation: QuotationDetail) {
  return `${quotation.number ?? `quotation-${quotation.id}`}.pdf`;
}

function sessionWhen(startsAt: Date | string | null) {
  if (!startsAt) return "Date to confirm";
  const date = startsAt instanceof Date ? startsAt : new Date(startsAt);
  if (Number.isNaN(date.getTime())) return "Date to confirm";
  return date.toISOString().slice(0, 16).replace("T", " ");
}

async function renderQuotationPdf(
  studio: Awaited<ReturnType<typeof loadStudio>>,
  quotation: QuotationDetail,
) {
  return buildQuotationPdf({
    studio,
    client: {
      name: quotation.client?.name ?? "Client",
      phone: quotation.client?.phone ?? null,
      email: quotation.client?.email ?? null,
    },
    number: quotation.number ?? `QUO-${quotation.id}`,
    currency: quotation.currency,
    issuedAt: quotation.createdAt ?? new Date(),
    intro: quotation.intro,
    notes: quotation.notes,
    lineItems: quotation.lineItems.map((line) => ({
      label: line.name,
      description: line.description,
      amount: line.amount,
    })),
    sessions: quotation.sessions.map((session, index) => ({
      label: session.label ?? `Session ${index + 1}`,
      when: sessionWhen(session.startsAt),
      venue: session.venue ?? "",
    })),
    totalAmount: quotation.totalAmount,
  });
}

export async function getQuotationPdf(studioId: number, id: number) {
  const quotation = await loadQuotation(studioId, id);
  const studio = await loadStudio(studioId);
  return {
    filename: quotationPdfFilename(quotation),
    buffer: await renderQuotationPdf(studio, quotation),
  };
}

/** Public quote page download — the booking-link token is the only key. */
export async function getPublicQuotationPdf(token: string) {
  if (!token || token.length < 8) {
    throw new QuotationServiceError("Quotation link not found.", 404);
  }

  const rows = await db
    .select({ id: quotations.id, studioId: quotations.studioId, status: quotations.status })
    .from(quotations)
    .where(eq(quotations.publicToken, token))
    .limit(1);

  const row = rows[0];
  if (!row || row.status === "LOST") {
    throw new QuotationServiceError("Quotation link not found.", 404);
  }

  return getQuotationPdf(row.studioId, row.id);
}
