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

const PAGE_MARGIN = 48;
const CONTENT_WIDTH = 595.28 - PAGE_MARGIN * 2;
const AMOUNT_WIDTH = 110;

function money(currency: string, amount: string) {
  const value = Number(amount);
  return `${currency} ${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
}

function renderToBuffer(
  draw: (doc: PDFKit.PDFDocument) => void,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
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

function drawHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  studio: StudioHeader,
  meta: { label: string; value: string }[],
) {
  doc.fontSize(18).font("Helvetica-Bold").text(studio.name);
  doc.fontSize(9).font("Helvetica").fillColor("#555555");
  const lines = [
    studio.address?.replace(/\s*\n\s*/g, ", "),
    [studio.phone, studio.email].filter(Boolean).join(" · "),
    studio.ssm ? `SSM ${studio.ssm}` : null,
  ].filter((line): line is string => Boolean(line && line.trim()));
  for (const line of lines) doc.text(line);

  doc.fillColor("#000000");
  doc.moveDown(1);
  doc.fontSize(22).font("Helvetica-Bold").text(title);
  doc.fontSize(10).font("Helvetica");
  for (const item of meta) {
    doc.text(`${item.label}: ${item.value}`);
  }
}

function drawClient(doc: PDFKit.PDFDocument, client: ClientHeader) {
  doc.moveDown(1);
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#555555").text("BILL TO");
  doc.fillColor("#000000").fontSize(11).font("Helvetica-Bold").text(client.name);
  const contact = [client.phone, client.email]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" · ");
  if (contact) {
    doc.fontSize(9).font("Helvetica").fillColor("#555555").text(contact);
    doc.fillColor("#000000");
  }
}

function drawRule(doc: PDFKit.PDFDocument) {
  doc
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
    .strokeColor("#dddddd")
    .lineWidth(1)
    .stroke()
    .strokeColor("#000000");
}

function drawRows(
  doc: PDFKit.PDFDocument,
  heading: string,
  amountHeading: string,
  rows: { left: string; sub?: string | null; right: string }[],
) {
  doc.moveDown(1.2);
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#555555");
  const headerY = doc.y;
  doc.text(heading, PAGE_MARGIN, headerY, {
    width: CONTENT_WIDTH - AMOUNT_WIDTH,
  });
  doc.text(amountHeading, PAGE_MARGIN + CONTENT_WIDTH - AMOUNT_WIDTH, headerY, {
    width: AMOUNT_WIDTH,
    align: "right",
  });
  doc.fillColor("#000000");
  doc.moveDown(0.4);
  drawRule(doc);

  if (rows.length === 0) {
    doc.moveDown(0.6);
    doc.fontSize(10).font("Helvetica").fillColor("#777777").text("None.");
    doc.fillColor("#000000");
    return;
  }

  for (const row of rows) {
    doc.moveDown(0.6);
    const rowY = doc.y;
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(row.left, PAGE_MARGIN, rowY, {
        width: CONTENT_WIDTH - AMOUNT_WIDTH - 12,
      });
    const afterLeftY = doc.y;
    doc.text(row.right, PAGE_MARGIN + CONTENT_WIDTH - AMOUNT_WIDTH, rowY, {
      width: AMOUNT_WIDTH,
      align: "right",
    });
    doc.y = afterLeftY;
    if (row.sub && row.sub.trim()) {
      doc
        .fontSize(9)
        .fillColor("#666666")
        .text(row.sub.trim(), PAGE_MARGIN, doc.y, {
          width: CONTENT_WIDTH - AMOUNT_WIDTH - 12,
        });
      doc.fillColor("#000000");
    }
    doc.moveDown(0.3);
    drawRule(doc);
  }
}

function drawTotal(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  bold = true,
) {
  doc.moveDown(0.6);
  const y = doc.y;
  doc.fontSize(bold ? 12 : 10).font(bold ? "Helvetica-Bold" : "Helvetica");
  doc.text(label, PAGE_MARGIN, y, {
    width: CONTENT_WIDTH - AMOUNT_WIDTH - 12,
    align: "right",
  });
  doc.text(value, PAGE_MARGIN + CONTENT_WIDTH - AMOUNT_WIDTH, y, {
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
  doc.moveDown(1.2);
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#555555").text(heading);
  doc
    .fillColor("#000000")
    .fontSize(10)
    .font("Helvetica")
    .text(body.trim(), { width: CONTENT_WIDTH });
}

export function buildQuotationPdf(input: QuotationPdfInput): Promise<Buffer> {
  return renderToBuffer((doc) => {
    drawHeader(doc, "QUOTATION", input.studio, [
      { label: "Number", value: input.number },
      { label: "Date", value: input.issuedAt.toISOString().slice(0, 10) },
    ]);
    drawClient(doc, input.client);
    drawParagraph(doc, "INTRO", input.intro);

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
    drawTotal(doc, "Total", money(input.currency, input.totalAmount));

    const sessions = input.sessions ?? [];
    if (sessions.length > 0) {
      doc.moveDown(1.2);
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#555555").text("SESSIONS");
      doc.fillColor("#000000").fontSize(10).font("Helvetica");
      for (const session of sessions) {
        const detail = [session.when, session.venue].filter(Boolean).join(" · ");
        doc.text(detail ? `${session.label} — ${detail}` : session.label);
      }
    }

    drawParagraph(doc, "NOTES", input.notes);
  });
}

export function buildInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  return renderToBuffer((doc) => {
    drawHeader(doc, "INVOICE", input.studio, [
      { label: "Number", value: input.number },
      { label: "Date", value: input.issuedAt.toISOString().slice(0, 10) },
      { label: "Status", value: input.status },
    ]);
    drawClient(doc, input.client);

    drawRows(
      doc,
      "MILESTONE",
      `AMOUNT (${input.currency})`,
      input.milestones.map((milestone) => ({
        left: milestone.label,
        sub: [
          milestone.dueDate ? `Due ${milestone.dueDate}` : null,
          milestone.paid ? "Paid" : null,
          milestone.description ?? null,
        ]
          .filter(Boolean)
          .join(" · "),
        right: money(input.currency, milestone.amount),
      })),
    );

    drawTotal(doc, "Total", money(input.currency, input.totalAmount));
    drawTotal(doc, "Paid", money(input.currency, input.paidAmount), false);
    drawTotal(doc, "Balance due", money(input.currency, input.balanceAmount));

    drawParagraph(doc, "NOTES", input.notes);
  });
}
