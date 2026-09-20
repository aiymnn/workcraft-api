import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";

export class MailerError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "MailerError";
  }
}

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
};

function trimmed(value: string | undefined) {
  const next = value?.trim();
  return next ? next : undefined;
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    trimmed(env.SMTP_HOST) && trimmed(env.SMTP_USER) && trimmed(env.SMTP_PASS),
  );
}

/** Sender shown to the client; falls back to the SMTP account. */
export function mailFrom(): string {
  return trimmed(env.SMTP_FROM) ?? trimmed(env.SMTP_USER) ?? "";
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  const host = trimmed(env.SMTP_HOST);
  const user = trimmed(env.SMTP_USER);
  const pass = trimmed(env.SMTP_PASS);

  if (!host || !user || !pass) {
    throw new MailerError(
      "Email sending is not configured on this server.",
      503,
    );
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port: env.SMTP_PORT,
      // 465 is implicit TLS; 587 upgrades with STARTTLS.
      secure: env.SMTP_PORT === 465,
      auth: { user, pass },
    });
  }

  return transporter;
}

export async function sendMail(input: SendMailInput) {
  const transport = getTransporter();

  try {
    const info = await transport.sendMail({
      from: mailFrom(),
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html !== undefined ? { html: input.html } : {}),
      ...(input.attachments !== undefined
        ? { attachments: input.attachments }
        : {}),
    });
    return { messageId: info.messageId, accepted: info.accepted };
  } catch (error) {
    console.error("SMTP send failed.", error);
    throw new MailerError("Unable to send the email right now.", 502);
  }
}
