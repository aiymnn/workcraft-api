import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import request from "supertest";

// env.ts reads process.env on import, so the credentials must exist first.
process.env.CHIP_BRAND_ID = "test-brand";
process.env.CHIP_API_KEY = "test-key";
process.env.CHIP_WEBHOOK_SECRET = "test-webhook-secret";

const { default: app } = await import("./app.js");
const { db } = await import("./db/database.js");
const { chipWebhookEvents } = await import(
  "./db/schema/chip_webhook_events.js"
);

function sign(body: string) {
  return createHmac("sha256", "test-webhook-secret").update(body).digest("hex");
}

describe("CHIP webhook (stubbed credentials)", () => {
  const email = process.env.SYSTEM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SYSTEM_ADMIN_PASSWORD;

  it("settles the referenced milestone once and ignores retries", async () => {
    expect(email).toBeTruthy();
    expect(password).toBeTruthy();

    const login = await request(app).post("/api/auth/login").send({
      email,
      password,
    });
    expect(login.status).toBe(200);
    const auth = { Authorization: `Bearer ${login.body.data.accessToken}` };
    const studioId = login.body.data.studio.id as number;

    const clientRes = await request(app)
      .post("/api/clients")
      .set(auth)
      .send({ name: `CHIP client ${Date.now()}` });
    const clientId = clientRes.body.data.client.id as number;

    const jobRes = await request(app)
      .post("/api/jobs")
      .set(auth)
      .send({
        clientId,
        sessions: [{ label: "Nikah", startsAt: "2026-12-20T02:00:00.000Z" }],
      });
    const jobId = jobRes.body.data.job.id as number;

    const invoiceRes = await request(app)
      .post("/api/money/invoices")
      .set(auth)
      .send({ jobId, milestones: [{ label: "Deposit", amount: 400 }] });
    const invoiceId = invoiceRes.body.data.invoice.id as number;
    const milestoneId = invoiceRes.body.data.invoice.milestones[0].id as number;

    const eventId = `evt_${Date.now()}`;
    const body = JSON.stringify({
      id: eventId,
      event_type: "purchase.paid",
      status: "paid",
      reference: `wc:${studioId}:${invoiceId}:${milestoneId}`,
    });

    const badSignature = await request(app)
      .post("/api/webhooks/chip")
      .set("Content-Type", "application/json")
      .set("X-Signature", "not-the-signature")
      .send(body);
    expect(badSignature.status).toBe(401);

    const paid = await request(app)
      .post("/api/webhooks/chip")
      .set("Content-Type", "application/json")
      .set("X-Signature", sign(body))
      .send(body);
    expect(paid.status).toBe(200);
    expect(paid.body.data).toMatchObject({ duplicate: false, settled: true });

    const payments = await request(app)
      .get("/api/money/payments")
      .query({ jobId })
      .set(auth);
    expect(payments.status).toBe(200);
    const settled = payments.body.data.items.find(
      (p: { milestoneId: number | null }) => p.milestoneId === milestoneId,
    );
    expect(settled.status).toBe("PAID");
    expect(settled.paidAt).toBeTruthy();

    const retry = await request(app)
      .post("/api/webhooks/chip")
      .set("Content-Type", "application/json")
      .set("X-Signature", sign(body))
      .send(body);
    expect(retry.status).toBe(200);
    expect(retry.body.data).toMatchObject({ duplicate: true, settled: false });

    // Studio CHIP flag is off, so checkout stays closed even with credentials.
    const tokenRes = await request(app)
      .post("/api/portal/tokens")
      .set(auth)
      .send({ jobId });
    const checkout = await request(app)
      .post(`/api/portal/${tokenRes.body.data.token}/checkout`)
      .send({ invoiceId });
    expect([409, 503]).toContain(checkout.status);

    await db
      .delete(chipWebhookEvents)
      .where(eq(chipWebhookEvents.eventId, `purchase.paid:${eventId}`));
    await request(app).delete(`/api/money/payments/${settled.id}`).set(auth);
    await request(app).delete(`/api/money/invoices/${invoiceId}`).set(auth);
    await request(app).delete(`/api/jobs/${jobId}`).set(auth);
    await request(app).delete(`/api/clients/${clientId}`).set(auth);
  });
});
