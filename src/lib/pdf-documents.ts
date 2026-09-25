import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import PDFDocument from "pdfkit";

type StudioHeader = {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  ssm?: string | null;
};

type ClientHeader = {
  name: string;
  phone?: string | null;
  email?: string | null;
};

type DocumentRow = {
  label: string;
  description?: string | null;
  amount: string;
};

export type QuotationPdfInput = {
  studio: StudioHeader;
  client: ClientHeader;
  number: string;
  currency: string;
  issuedAt: Date;
  intro?: string | null;
  notes?: string | null;
  lineItems: DocumentRow[];
  sessions?: { label: string; when: string; venue: string }[];
  totalAmount: string;
};

export type InvoicePdfInput = {
  studio: StudioHeader;
  client: ClientHeader;
  number: string;
  currency: string;
  issuedAt: Date;
  status: string;
  notes?: string | null;
  milestones: (DocumentRow & { dueDate: string; paid: boolean })[];
  totalAmount: string;
  paidAmount: string;
  balanceAmount: string;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const AMOUNT_WIDTH = 120;
const HEADER_HEIGHT = 108;
const FOOTER_HEIGHT = 36;

const INK = "#1a1a1a";
const MUTED = "#5f5f5f";
const LINE = "#e4e4e4";
const BAND = "#303030";
const PAPER = "#f6f6f6";
const WHITE = "#ffffff";

function money(currency: string, amount: string) {
  const value = Number(amount);
  return `${currency} ${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function logoBuffer(): Buffer | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../../assets/workcraft-mark.jpg"),
    path.resolve(process.cwd(), "assets/workcraft-mark.jpg"),
    path.resolve(process.cwd(), "backend/assets/workcraft-mark.jpg"),
  ];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) return null;
  return readFileSync(file);
}

function renderToBuffer(
  draw: (doc: PDFKit.PDFDocument) => void,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      info: {
        Title: "Workcraft document",
        Author: "Workcraft Studio",
      },
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      draw(doc);
      doc.end();
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

function ensureRoom(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > PAGE_HEIGHT - FOOTER_HEIGHT - 16) {
    doc.addPage();
    doc.y = PAGE_MARGIN;
  }
}

function drawBrandHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  meta: { label: string; value: string }[],
) {
  doc.save();
  doc.rect(0, 0, PAGE_WIDTH, HEADER_HEIGHT).fill(BAND);

  const mark = logoBuffer();
  if (mark) {
    doc.image(mark, PAGE_MARGIN, 18, {
      fit: [168, 72],
      align: "left",
      valign: "center",
    });
  } else {
    doc
      .fillColor(WHITE)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("WORKCRAFT STUDIO", PAGE_MARGIN, 42, { width: 200 });
  }

  const metaWidth = 220;
  const metaX = PAGE_WIDTH - PAGE_MARGIN - metaWidth;
  doc
    .fillColor(WHITE)
    .font("Helvetica-Bold")
    .fontSize(16)
    .text(title, metaX, 28, { width: metaWidth, align: "right" });

  let metaY = 52;
  doc.font("Helvetica").fontSize(9).fillColor("#d6d6d6");
  for (const item of meta) {
    doc.text(`${item.label}  ${item.value}`, metaX, metaY, {
      width: metaWidth,
      align: "right",
      lineGap: 1,
    });
    metaY += 13;
  }
  doc.restore();
  doc.fillColor(INK);
  doc.y = HEADER_HEIGHT + 22;
}

function drawParties(
  doc: PDFKit.PDFDocument,
  studio: StudioHeader,
  client: ClientHeader,
) {
  const columnWidth = (CONTENT_WIDTH - 24) / 2;
  const top = doc.y;
  const leftX = PAGE_MARGIN;
  const rightX = PAGE_MARGIN + columnWidth + 24;

  const studioLines = [
    studio.name,
    studio.address?.replace(/\s*\n\s*/g, ", ") ?? null,
    [studio.phone, studio.email].filter(Boolean).join(" · ") || null,
    studio.ssm ? `SSM ${studio.ssm}` : null,
  ].filter((line): line is string => Boolean(line && line.trim()));

  const clientLines = [
    client.name,
    [client.phone, client.email].filter(Boolean).join(" · ") || null,
  ].filter((line): line is string => Boolean(line && line.trim()));

  function column(label: string, lines: string[], x: number) {
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(MUTED)
      .text(label, x, top, { width: columnWidth, characterSpacing: 0.6 });
    let y = top + 14;
    lines.forEach((line, index) => {
      doc
        .font(index === 0 ? "Helvetica-Bold" : "Helvetica")
        .fontSize(index === 0 ? 11 : 9)
        .fillColor(index === 0 ? INK : MUTED)
        .text(line, x, y, { width: columnWidth });
      y = doc.y + 2;
    });
    return y;
  }

  const leftBottom = column("FROM", studioLines, leftX);
  const rightBottom = column("BILL TO", clientLines, rightX);
  doc.y = Math.max(leftBottom, rightBottom) + 8;
  doc.fillColor(INK);
}

function drawRule(doc: PDFKit.PDFDocument) {
  const y = doc.y;
  doc
    .moveTo(PAGE_MARGIN, y)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y)
    .strokeColor(LINE)
    .lineWidth(1)
    .stroke()
    .strokeColor(INK);
}

function drawRows(
  doc: PDFKit.PDFDocument,
  heading: string,
  amountHeading: string,
  rows: { left: string; sub?: string | null; right: string }[],
) {
  ensureRoom(doc, 48);
  doc.moveDown(0.8);
  const headerY = doc.y;
  doc.save();
  doc.rect(PAGE_MARGIN, headerY, CONTENT_WIDTH, 22).fill(PAPER);
  doc.restore();
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(MUTED)
    .text(heading, PAGE_MARGIN + 8, headerY + 7, {
      width: CONTENT_WIDTH - AMOUNT_WIDTH - 16,
    });
  doc.text(amountHeading, PAGE_MARGIN + CONTENT_WIDTH - AMOUNT_WIDTH - 8, headerY + 7, {
    width: AMOUNT_WIDTH,
    align: "right",
  });
  doc.y = headerY + 28;
  doc.fillColor(INK);

  if (rows.length === 0) {
    doc.fontSize(10).font("Helvetica").fillColor(MUTED).text("None.", PAGE_MARGIN, doc.y);
    doc.fillColor(INK);
    return;
  }

  for (const row of rows) {
    ensureRoom(doc, 36);
    const rowY = doc.y;
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor(INK)
      .text(row.left, PAGE_MARGIN, rowY, {
        width: CONTENT_WIDTH - AMOUNT_WIDTH - 12,
      });
    const afterLeftY = doc.y;
    doc
      .font("Helvetica")
      .fontSize(10)
      .text(row.right, PAGE_MARGIN + CONTENT_WIDTH - AMOUNT_WIDTH, rowY, {
        width: AMOUNT_WIDTH,
        align: "right",
      });
    doc.y = Math.max(afterLeftY, rowY + 12);
    if (row.sub && row.sub.trim()) {
      doc
        .fontSize(8)
        .fillColor(MUTED)
        .text(row.sub.trim(), PAGE_MARGIN, doc.y + 1, {
          width: CONTENT_WIDTH - AMOUNT_WIDTH - 12,
        });
      doc.fillColor(INK);
    }
    doc.moveDown(0.35);
    drawRule(doc);
    doc.moveDown(0.35);
  }
}

function drawTotal(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  emphasis = false,
) {
  ensureRoom(doc, 28);
  doc.moveDown(emphasis ? 0.5 : 0.2);
  const y = doc.y;
  if (emphasis) {
    doc.save();
    doc.rect(PAGE_MARGIN + CONTENT_WIDTH - 240, y - 6, 240, 28).fill(BAND);
    doc.restore();
    doc
      .fillColor(WHITE)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(label, PAGE_MARGIN + CONTENT_WIDTH - 232, y + 2, {
        width: 110,
        align: "left",
      });
    doc.text(value, PAGE_MARGIN + CONTENT_WIDTH - AMOUNT_WIDTH, y + 2, {
      width: AMOUNT_WIDTH - 8,
      align: "right",
    });
    doc.y = y + 28;
    doc.fillColor(INK);
    return;
  }

  doc.fontSize(10).font("Helvetica").fillColor(MUTED);
  doc.text(label, PAGE_MARGIN, y, {
    width: CONTENT_WIDTH - AMOUNT_WIDTH - 12,
    align: "right",
  });
  doc
    .fillColor(INK)
    .text(value, PAGE_MARGIN + CONTENT_WIDTH - AMOUNT_WIDTH, y, {
      width: AMOUNT_WIDTH,
      align: "right",
    });
}

function drawParagraph(
  doc: PDFKit.PDFDocument,
  heading: string,
  body: string | null | undefined,
) {
  if (!body || !body.trim()) return;
  ensureRoom(doc, 40);
  doc.moveDown(1);
  doc.fontSize(8).font("Helvetica-Bold").fillColor(MUTED).text(heading);
  doc
    .fillColor(INK)
    .fontSize(10)
    .font("Helvetica")
    .text(body.trim(), { width: CONTENT_WIDTH });
}

function drawFooter(doc: PDFKit.PDFDocument) {
  const y = PAGE_HEIGHT - 28;
  doc
    .moveTo(PAGE_MARGIN, y - 8)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y - 8)
    .strokeColor(LINE)
    .lineWidth(1)
    .stroke();
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(MUTED)
    .text("Workcraft Studio", PAGE_MARGIN, y, {
      width: CONTENT_WIDTH,
      align: "left",
      lineBreak: false,
    });
  doc.text("Thank you", PAGE_MARGIN, y, {
    width: CONTENT_WIDTH,
    align: "right",
    lineBreak: false,
  });
  doc.fillColor(INK);
}

function invoiceTitle(status: string) {
  return status === "PAID" ? "RECEIPT" : "INVOICE";
}

export function buildQuotationPdf(input: QuotationPdfInput): Promise<Buffer> {
  return renderToBuffer((doc) => {
    drawBrandHeader(doc, "QUOTATION", [
      { label: "No.", value: input.number },
      { label: "Date", value: formatDate(input.issuedAt) },
    ]);
    drawParties(doc, input.studio, input.client);
    drawParagraph(doc, "INTRODUCTION", input.intro);

    drawRows(
      doc,
      "ITEM",
      `AMOUNT (${input.currency})`,
      input.lineItems.map((line) => ({
        left: line.label,
        sub: line.description ?? null,
        right: money(input.currency, line.amount),
      })),
    );
    drawTotal(doc, "Total", money(input.currency, input.totalAmount), true);

    const sessions = input.sessions ?? [];
    if (sessions.length > 0) {
      ensureRoom(doc, 36);
      doc.moveDown(1);
      doc.fontSize(8).font("Helvetica-Bold").fillColor(MUTED).text("SESSIONS");
      doc.fillColor(INK).fontSize(10).font("Helvetica");
      for (const session of sessions) {
        ensureRoom(doc, 16);
        const detail = [session.when, session.venue].filter(Boolean).join(" · ");
        doc.text(detail ? `${session.label} — ${detail}` : session.label, {
          width: CONTENT_WIDTH,
        });
      }
    }

    drawParagraph(doc, "NOTES", input.notes);
    drawFooter(doc);
  });
}

export function buildInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  const title = invoiceTitle(input.status);
  return renderToBuffer((doc) => {
    drawBrandHeader(doc, title, [
      { label: "No.", value: input.number },
      { label: "Date", value: formatDate(input.issuedAt) },
      { label: "Status", value: input.status },
    ]);
    drawParties(doc, input.studio, input.client);

    drawRows(
      doc,
      "MILESTONE",
      `AMOUNT (${input.currency})`,
      input.milestones.map((milestone) => ({
        left: milestone.label,
        sub: [
          milestone.dueDate ? `Due ${milestone.dueDate}` : null,
          milestone.paid ? "Paid" : "Unpaid",
          milestone.description ?? null,
        ]
          .filter(Boolean)
          .join(" · "),
        right: money(input.currency, milestone.amount),
      })),
    );

    drawTotal(doc, "Total", money(input.currency, input.totalAmount));
    drawTotal(doc, "Paid", money(input.currency, input.paidAmount));
    drawTotal(
      doc,
      title === "RECEIPT" ? "Paid in full" : "Balance due",
      money(
        input.currency,
        title === "RECEIPT" ? input.paidAmount : input.balanceAmount,
      ),
      true,
    );

    drawParagraph(doc, "NOTES", input.notes);
    drawFooter(doc);
  });
}

export type CrewSchedulePdfInput = {
  studioName: string;
  whoLabel: string;
  windowLabel: string;
  rows: {
    date: string;
    start: string;
    end: string;
    type: string;
    clientName: string;
    venue: string;
    role: string;
    personName?: string | null;
  }[];
};

export function buildCrewSchedulePdf(
  input: CrewSchedulePdfInput,
): Promise<Buffer> {
  return renderToBuffer((doc) => {
    drawBrandHeader(doc, "CREW SCHEDULE", [
      { label: "Who", value: input.whoLabel },
      { label: "Window", value: input.windowLabel },
      { label: "Printed", value: formatDate(new Date()) },
    ]);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(INK)
      .text(input.studioName, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc
      .fontSize(9)
      .fillColor(MUTED)
      .text(
        "Assignments on the books for this window. Cancelled jobs are not included.",
        PAGE_MARGIN,
        doc.y + 2,
        { width: CONTENT_WIDTH },
      );
    doc.fillColor(INK);
    doc.moveDown(0.8);

    if (input.rows.length === 0) {
      doc.fontSize(11).font("Helvetica").text("No assignments in this window.");
      drawFooter(doc);
      return;
    }

    const showWho = input.whoLabel === "Everyone";
    for (const row of input.rows) {
      ensureRoom(doc, 48);
      const top = doc.y;
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(INK)
        .text(`${row.date}  ·  ${row.start}–${row.end}`, PAGE_MARGIN, top, {
          width: CONTENT_WIDTH,
        });
      const who = showWho && row.personName ? `${row.personName} · ` : "";
      doc
        .font("Helvetica")
        .fontSize(10)
        .text(`${row.type} · ${row.clientName}`, { width: CONTENT_WIDTH });
      doc
        .fontSize(9)
        .fillColor(MUTED)
        .text(`${who}${row.role} · ${row.venue}`, { width: CONTENT_WIDTH });
      doc.fillColor(INK);
      doc.moveDown(0.35);
      drawRule(doc);
      doc.moveDown(0.45);
    }

    drawFooter(doc);
  });
}
