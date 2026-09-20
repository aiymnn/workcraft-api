import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "./app.js";

describe("API health", () => {
  it("returns API health", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("rejects protected users endpoint without token", async () => {
    const response = await request(app).get("/api/users");

    expect(response.status).toBe(401);
    expect(response.body.code).toBeUndefined();
    expect(response.body.status).toBe("error");
  });
});

describe("Slice 1 studio APIs", () => {
  const email = process.env.SYSTEM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SYSTEM_ADMIN_PASSWORD;

  it("login → me includes studio; clients and settings respond", async () => {
    expect(email, "SYSTEM_ADMIN_EMAIL required for smoke").toBeTruthy();
    expect(password, "SYSTEM_ADMIN_PASSWORD required for smoke").toBeTruthy();

    const login = await request(app).post("/api/auth/login").send({
      email,
      password,
    });

    expect(login.status).toBe(200);
    expect(login.body.status).toBe("success");
    expect(login.body.data.accessToken).toBeTruthy();
    expect(login.body.data.studio).toMatchObject({
      id: expect.any(Number),
      name: expect.any(String),
    });
    expect(["OWNER", "ADMIN", "MEMBER"]).toContain(login.body.data.access);

    const token = login.body.data.accessToken as string;
    const auth = { Authorization: `Bearer ${token}` };

    const me = await request(app).get("/api/auth/me").set(auth);
    expect(me.status).toBe(200);
    expect(me.body.status).toBe("success");
    expect(me.body.data.studio).toMatchObject({
      id: login.body.data.studio.id,
      name: expect.any(String),
    });
    expect(me.body.data.access).toBe(login.body.data.access);

    const clients = await request(app).get("/api/clients").set(auth);
    expect(clients.status).toBe(200);
    expect(clients.body.status).toBe("success");
    expect(Array.isArray(clients.body.data.items)).toBe(true);

    const studio = await request(app).get("/api/settings/studio").set(auth);
    expect(studio.status).toBe(200);
    expect(studio.body.status).toBe("success");
    expect(studio.body.data.studio.id).toBe(login.body.data.studio.id);

    const options = await request(app).get("/api/settings/options").set(auth);
    expect(options.status).toBe(200);
    expect(options.body.status).toBe("success");
    expect(Array.isArray(options.body.data.catalogs)).toBe(true);
  });

  it("team members/crew and account profile respond", async () => {
    expect(email).toBeTruthy();
    expect(password).toBeTruthy();

    const login = await request(app).post("/api/auth/login").send({
      email,
      password,
    });
    expect(login.status).toBe(200);
    const token = login.body.data.accessToken as string;
    const auth = { Authorization: `Bearer ${token}` };

    const members = await request(app).get("/api/team/members").set(auth);
    expect(members.status).toBe(200);
    expect(members.body.status).toBe("success");
    expect(Array.isArray(members.body.data.members)).toBe(true);
    expect(members.body.data.members.length).toBeGreaterThanOrEqual(1);

    const crew = await request(app).get("/api/team/crew").set(auth);
    expect(crew.status).toBe(200);
    expect(crew.body.status).toBe("success");
    expect(Array.isArray(crew.body.data.crew)).toBe(true);

    const profile = await request(app).get("/api/account/profile").set(auth);
    expect(profile.status).toBe(200);
    expect(profile.body.status).toBe("success");
    expect(profile.body.data.user.email).toBe(email);
    expect(profile.body.data.studio).toMatchObject({
      id: login.body.data.studio.id,
    });

    expect(profile.body.data.connections).toMatchObject({
      googleConfigured: expect.any(Boolean),
      footagePortalEnabled: expect.any(Boolean),
    });
  });

  it("settings templates list and package create/delete", async () => {
    expect(email).toBeTruthy();
    expect(password).toBeTruthy();

    const login = await request(app).post("/api/auth/login").send({
      email,
      password,
    });
    expect(login.status).toBe(200);
    const auth = { Authorization: `Bearer ${login.body.data.accessToken}` };

    const packages = await request(app).get("/api/settings/packages").set(auth);
    expect(packages.status).toBe(200);
    expect(Array.isArray(packages.body.data.packages)).toBe(true);

    const plans = await request(app).get("/api/settings/payment-plans").set(auth);
    expect(plans.status).toBe(200);
    expect(Array.isArray(plans.body.data.plans)).toBe(true);

    const created = await request(app)
      .post("/api/settings/packages")
      .set(auth)
      .send({
        name: `Smoke package ${Date.now()}`,
        price: 99.5,
        description: "Vitest smoke",
      });
    expect(created.status).toBe(201);
    expect(created.body.data.package.name).toContain("Smoke package");

    const id = created.body.data.package.id as number;
    const deleted = await request(app)
      .delete(`/api/settings/packages/${id}`)
      .set(auth);
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.deleted).toBe(true);

    const seededEmail = await request(app)
      .post("/api/settings/email-templates/seed")
      .set(auth);
    expect(seededEmail.status).toBe(200);
    expect(seededEmail.body.data.templates.length).toBeGreaterThanOrEqual(5);

    const seededWa = await request(app)
      .post("/api/settings/whatsapp-templates/seed")
      .set(auth);
    expect(seededWa.status).toBe(200);
    expect(seededWa.body.data.templates.length).toBeGreaterThanOrEqual(6);
  });

  it("quotations list and create with allocated number", async () => {
    expect(email).toBeTruthy();
    expect(password).toBeTruthy();

    const login = await request(app).post("/api/auth/login").send({
      email,
      password,
    });
    expect(login.status).toBe(200);
    const auth = { Authorization: `Bearer ${login.body.data.accessToken}` };

    const clientRes = await request(app)
      .post("/api/clients")
      .set(auth)
      .send({ name: `Quote client ${Date.now()}` });
    expect(clientRes.status).toBe(201);
    const clientId = clientRes.body.data.client.id as number;

    const created = await request(app)
      .post("/api/quotations")
      .set(auth)
      .send({
        clientId,
        lineItems: [
          {
            name: "Smoke package",
            quantity: 1,
            unitPrice: 500,
          },
        ],
        sessions: [{ label: "Nikah", venue: "Studio" }],
        paymentRows: [
          {
            label: "Deposit",
            type: "FIXED",
            value: 100,
            dueN: 0,
            dueUnit: "DAYS",
            dueAnchor: "TODAY",
          },
        ],
      });

    expect(created.status).toBe(201);
    expect(created.body.data.quotation.number).toMatch(/^QUO-\d{4}-\d{4}$/);
    expect(created.body.data.quotation.totalAmount).toBe("500.00");
    expect(created.body.data.quotation.lineItems).toHaveLength(1);
    expect(created.body.data.quotation.sessions).toHaveLength(1);

    const list = await request(app).get("/api/quotations").set(auth);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data.items)).toBe(true);

    const quoteId = created.body.data.quotation.id as number;
    await request(app).delete(`/api/quotations/${quoteId}`).set(auth);
    await request(app).delete(`/api/clients/${clientId}`).set(auth);
  });

  it("booking link + public quote accept is idempotent", async () => {
    expect(email).toBeTruthy();
    expect(password).toBeTruthy();

    const login = await request(app).post("/api/auth/login").send({
      email,
      password,
    });
    expect(login.status).toBe(200);
    const auth = { Authorization: `Bearer ${login.body.data.accessToken}` };

    const clientRes = await request(app)
      .post("/api/clients")
      .set(auth)
      .send({ name: `Public quote client ${Date.now()}` });
    const clientId = clientRes.body.data.client.id as number;

    const created = await request(app)
      .post("/api/quotations")
      .set(auth)
      .send({
        clientId,
        status: "SENT",
        lineItems: [{ name: "Package A", quantity: 1, unitPrice: 1200 }],
        sessions: [{ label: "Nikah", venue: "Masjid" }],
        contracts: [{ name: "Terms", body: "Agreement body" }],
      });
    expect(created.status).toBe(201);
    const quoteId = created.body.data.quotation.id as number;

    const link = await request(app)
      .post(`/api/quotations/${quoteId}/booking-link`)
      .set(auth)
      .send({});
    expect(link.status).toBe(201);
    expect(link.body.data.token).toBeTruthy();
    expect(link.body.data.urlPath).toBe(`/quote/${link.body.data.token}`);
    const token = link.body.data.token as string;

    const rotated = await request(app)
      .post(`/api/quotations/${quoteId}/booking-link`)
      .set(auth)
      .send({ rotate: true });
    expect(rotated.status).toBe(201);
    expect(rotated.body.data.token).not.toBe(token);
    const liveToken = rotated.body.data.token as string;

    const stale = await request(app).get(`/api/public/quotations/${token}`);
    expect(stale.status).toBe(404);

    const publicQuote = await request(app).get(
      `/api/public/quotations/${liveToken}`,
    );
    expect(publicQuote.status).toBe(200);
    expect(publicQuote.body.data.quotation.id).toBe(quoteId);
    expect(publicQuote.body.data.quotation.status).toBe("SENT");
    expect(publicQuote.body.data.studio.name).toBeTruthy();
    expect(publicQuote.body.data.client.id).toBe(clientId);

    const missingAgreement = await request(app)
      .post(`/api/public/quotations/${liveToken}/accept`)
      .send({});
    expect(missingAgreement.status).toBe(400);

    const sessionId = publicQuote.body.data.quotation.sessions[0].id as number;
    const accepted = await request(app)
      .post(`/api/public/quotations/${liveToken}/accept`)
      .send({
        agreementAccepted: true,
        sessions: [
          { id: sessionId, startsAt: "2026-12-12T02:00:00.000Z", venue: "Hall B" },
        ],
      });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.alreadyAccepted).toBe(false);
    expect(accepted.body.data.quotation.status).toBe("ACCEPTED");
    expect(accepted.body.data.quotation.acceptedVia).toBe("PUBLIC");
    expect(accepted.body.data.quotation.acceptedAt).toBeTruthy();
    expect(accepted.body.data.quotation.sessions[0].venue).toBe("Hall B");
    expect(accepted.body.data.quotation.sessions[0].startsAt).toBeTruthy();

    const again = await request(app)
      .post(`/api/public/quotations/${liveToken}/accept`)
      .send({ agreementAccepted: true });
    expect(again.status).toBe(200);
    expect(again.body.data.alreadyAccepted).toBe(true);

    // Converting an already-accepted quote keeps the PUBLIC acceptance trail.
    const convert = await request(app)
      .post(`/api/quotations/${quoteId}/convert`)
      .set(auth)
      .send({});
    expect(convert.status).toBe(201);
    expect(convert.body.data.quotation.acceptedVia).toBe("PUBLIC");
    expect(convert.body.data.job.quotationId).toBe(quoteId);
    expect(convert.body.data.job.sessions).toHaveLength(1);
    expect(convert.body.data.job.contracts[0].status).toBe("DRAFT");

    const jobId = convert.body.data.job.id as number;
    await request(app).delete(`/api/jobs/${jobId}`).set(auth);
    await request(app).delete(`/api/quotations/${quoteId}`).set(auth);
    await request(app).delete(`/api/clients/${clientId}`).set(auth);
  });

  it("convert quotation to job is idempotent and rejects LOST", async () => {
    expect(email).toBeTruthy();
    expect(password).toBeTruthy();

    const login = await request(app).post("/api/auth/login").send({
      email,
      password,
    });
    expect(login.status).toBe(200);
    const auth = { Authorization: `Bearer ${login.body.data.accessToken}` };

    const clientRes = await request(app)
      .post("/api/clients")
      .set(auth)
      .send({ name: `Convert client ${Date.now()}` });
    const clientId = clientRes.body.data.client.id as number;

    const created = await request(app)
      .post("/api/quotations")
      .set(auth)
      .send({
        clientId,
        lineItems: [{ name: "Package B", quantity: 1, unitPrice: 900 }],
        sessions: [{ label: "Reception", venue: "Garden" }],
      });
    expect(created.status).toBe(201);
    const quoteId = created.body.data.quotation.id as number;
    expect(created.body.data.quotation.jobId).toBeNull();

    const convert = await request(app)
      .post(`/api/quotations/${quoteId}/convert`)
      .set(auth)
      .send({});
    expect(convert.status).toBe(201);
    expect(convert.body.data.quotation.status).toBe("ACCEPTED");
    expect(convert.body.data.quotation.acceptedVia).toBe("STAFF");
    expect(convert.body.data.job.status).toBe("CONFIRMED");
    // Undated quote session falls back to a default start so it lands on the calendar.
    expect(convert.body.data.job.sessions[0].startsAt).toBeTruthy();
    expect(convert.body.data.job.sessions[0].label).toBe("Reception");

    const jobId = convert.body.data.job.id as number;

    const secondConvert = await request(app)
      .post(`/api/quotations/${quoteId}/convert`)
      .set(auth)
      .send({});
    expect(secondConvert.status).toBe(200);
    expect(secondConvert.body.data.job.id).toBe(jobId);

    const list = await request(app)
      .get("/api/quotations")
      .query({ search: created.body.data.quotation.number })
      .set(auth);
    expect(list.status).toBe(200);
    expect(
      list.body.data.items.find((i: { id: number }) => i.id === quoteId)?.jobId,
    ).toBe(jobId);

    const lostClient = await request(app)
      .post("/api/clients")
      .set(auth)
      .send({ name: `Lost client ${Date.now()}` });
    const lostClientId = lostClient.body.data.client.id as number;
    const lostQuote = await request(app)
      .post("/api/quotations")
      .set(auth)
      .send({ clientId: lostClientId, status: "LOST" });
    const lostQuoteId = lostQuote.body.data.quotation.id as number;

    const rejected = await request(app)
      .post(`/api/quotations/${lostQuoteId}/convert`)
      .set(auth)
      .send({});
    expect(rejected.status).toBe(409);

    const lostLink = await request(app)
      .post(`/api/quotations/${lostQuoteId}/booking-link`)
      .set(auth)
      .send({});
    expect(lostLink.status).toBe(201);
    const lostPublic = await request(app).get(
      `/api/public/quotations/${lostLink.body.data.token}`,
    );
    expect(lostPublic.status).toBe(404);
    const lostAccept = await request(app)
      .post(`/api/public/quotations/${lostLink.body.data.token}/accept`)
      .send({ agreementAccepted: true });
    expect(lostAccept.status).toBe(409);

    await request(app).delete(`/api/jobs/${jobId}`).set(auth);
    await request(app).delete(`/api/quotations/${quoteId}`).set(auth);
    await request(app).delete(`/api/clients/${clientId}`).set(auth);
    await request(app).delete(`/api/quotations/${lostQuoteId}`).set(auth);
    await request(app).delete(`/api/clients/${lostClientId}`).set(auth);
  });

  it("jobs create with session and calendar range", async () => {
    expect(email).toBeTruthy();
    expect(password).toBeTruthy();

    const login = await request(app).post("/api/auth/login").send({
      email,
      password,
    });
    expect(login.status).toBe(200);
    const auth = { Authorization: `Bearer ${login.body.data.accessToken}` };

    const clientRes = await request(app)
      .post("/api/clients")
      .set(auth)
      .send({ name: `Job client ${Date.now()}` });
    expect(clientRes.status).toBe(201);
    const clientId = clientRes.body.data.client.id as number;

    const startsAt = "2026-10-15T10:00:00.000Z";
    const created = await request(app)
      .post("/api/jobs")
      .set(auth)
      .send({
        clientId,
        sessions: [
          {
            label: "Nikah",
            startsAt,
            venue: "Studio A",
          },
        ],
        checklistItems: [
          { label: "Confirm venue", phase: "BEFORE" },
          { label: "Shoot", phase: "ON_DAY" },
        ],
        deliverables: [{ title: "Edited photos", status: "PENDING" }],
      });

    expect(created.status).toBe(201);
    expect(created.body.data.job.number).toMatch(/^JOB-\d{4}-\d{4}$/);
    expect(created.body.data.job.sessions).toHaveLength(1);
    expect(created.body.data.job.checklistItems).toHaveLength(2);

    const jobId = created.body.data.job.id as number;
    const itemId = created.body.data.job.checklistItems[0].id as number;

    const toggled = await request(app)
      .patch(`/api/jobs/${jobId}/checklist/${itemId}`)
      .set(auth)
      .send({ done: true });
    expect(toggled.status).toBe(200);
    expect(
      toggled.body.data.job.checklistItems.find(
        (i: { id: number }) => i.id === itemId,
      )?.doneAt,
    ).toBeTruthy();

    const calendar = await request(app)
      .get("/api/calendar/sessions")
      .query({
        from: "2026-10-01T00:00:00.000Z",
        to: "2026-10-31T23:59:59.000Z",
      })
      .set(auth);
    expect(calendar.status).toBe(200);
    expect(
      calendar.body.data.sessions.some(
        (s: { job: { id: number } }) => s.job.id === jobId,
      ),
    ).toBe(true);

    await request(app).delete(`/api/jobs/${jobId}`).set(auth);
    await request(app).delete(`/api/clients/${clientId}`).set(auth);
  });

  it("money invoice/expense and public portal token", async () => {
    expect(email).toBeTruthy();
    expect(password).toBeTruthy();

    const login = await request(app).post("/api/auth/login").send({
      email,
      password,
    });
    expect(login.status).toBe(200);
    const auth = { Authorization: `Bearer ${login.body.data.accessToken}` };

    const clientRes = await request(app)
      .post("/api/clients")
      .set(auth)
      .send({ name: `Money client ${Date.now()}` });
    expect(clientRes.status).toBe(201);
    const clientId = clientRes.body.data.client.id as number;

    const jobRes = await request(app)
      .post("/api/jobs")
      .set(auth)
      .send({
        clientId,
        sessions: [{ label: "Event", startsAt: "2026-11-01T04:00:00.000Z" }],
        deliverables: [
          { title: "Gallery", status: "DELIVERED", clientVisible: true },
        ],
      });
    expect(jobRes.status).toBe(201);
    const jobId = jobRes.body.data.job.id as number;

    const invoice = await request(app)
      .post("/api/money/invoices")
      .set(auth)
      .send({
        jobId,
        milestones: [
          { label: "Deposit", amount: 300 },
          { label: "Balance", amount: 700 },
        ],
      });
    expect(invoice.status).toBe(201);
    expect(invoice.body.data.invoice.number).toMatch(/^INV-\d{4}-\d{4}$/);
    expect(invoice.body.data.invoice.milestones).toHaveLength(2);

    const expense = await request(app)
      .post("/api/money/expenses")
      .set(auth)
      .send({
        amount: 50,
        spentAt: "2026-11-02T00:00:00.000Z",
        taxBucket: "CLAIMABLE",
        notes: "Smoke expense",
      });
    expect(expense.status).toBe(201);

    const tokenRes = await request(app)
      .post("/api/portal/tokens")
      .set(auth)
      .send({ jobId });
    expect(tokenRes.status).toBe(201);
    expect(tokenRes.body.data.token).toBeTruthy();

    const publicPortal = await request(app).get(
      `/api/portal/${tokenRes.body.data.token}`,
    );
    expect(publicPortal.status).toBe(200);
    expect(publicPortal.body.data.job.id).toBe(jobId);
    expect(publicPortal.body.data.studio.name).toBeTruthy();
    expect(publicPortal.body.data.invoices.length).toBeGreaterThanOrEqual(1);

    await request(app)
      .delete(`/api/money/invoices/${invoice.body.data.invoice.id}`)
      .set(auth);
    await request(app)
      .delete(`/api/money/expenses/${expense.body.data.expense.id}`)
      .set(auth);
    await request(app).delete(`/api/jobs/${jobId}`).set(auth);
    await request(app).delete(`/api/clients/${clientId}`).set(auth);
  });

  it("share message returns a public link and PDFs download", async () => {
    expect(email).toBeTruthy();
    expect(password).toBeTruthy();

    const login = await request(app).post("/api/auth/login").send({
      email,
      password,
    });
    expect(login.status).toBe(200);
    const auth = { Authorization: `Bearer ${login.body.data.accessToken}` };

    const clientRes = await request(app)
      .post("/api/clients")
      .set(auth)
      .send({
        name: `Share client ${Date.now()}`,
        email: "share-client@example.com",
        phone: "0123456789",
      });
    expect(clientRes.status).toBe(201);
    const clientId = clientRes.body.data.client.id as number;

    const created = await request(app)
      .post("/api/quotations")
      .set(auth)
      .send({
        clientId,
        lineItems: [{ name: "Wave B package", quantity: 1, unitPrice: 1500 }],
        sessions: [{ label: "Nikah", venue: "Studio" }],
      });
    expect(created.status).toBe(201);
    const quoteId = created.body.data.quotation.id as number;

    // Share message must work with no SMTP configured at all.
    const share = await request(app)
      .post(`/api/quotations/${quoteId}/share-message`)
      .set(auth)
      .send({ channel: "whatsapp", markSent: true });
    expect(share.status).toBe(200);
    expect(share.body.data.link).toContain("/quote/");
    expect(share.body.data.token).toBeTruthy();
    expect(share.body.data.text).toContain(share.body.data.link);
    expect(share.body.data.waUrl).toContain("https://wa.me/60123456789");
    expect(share.body.data.status).toBe("SENT");

    const emailShare = await request(app)
      .post(`/api/quotations/${quoteId}/share-message`)
      .set(auth)
      .send({ channel: "email" });
    expect(emailShare.status).toBe(200);
    expect(emailShare.body.data.subject).toBeTruthy();

    const quotePdf = await request(app)
      .get(`/api/quotations/${quoteId}/pdf`)
      .set(auth);
    expect(quotePdf.status).toBe(200);
    expect(quotePdf.headers["content-type"]).toContain("application/pdf");

    const publicPdf = await request(app).get(
      `/api/public/quotations/${share.body.data.token}/pdf`,
    );
    expect(publicPdf.status).toBe(200);
    expect(publicPdf.headers["content-type"]).toContain("application/pdf");

    const convert = await request(app)
      .post(`/api/quotations/${quoteId}/convert`)
      .set(auth)
      .send({});
    expect(convert.status).toBe(201);
    const jobId = convert.body.data.job.id as number;

    const invoice = await request(app)
      .post("/api/money/invoices")
      .set(auth)
      .send({
        jobId,
        milestones: [
          { label: "Deposit", amount: 500 },
          { label: "Balance", amount: 1000 },
        ],
      });
    expect(invoice.status).toBe(201);
    const invoiceId = invoice.body.data.invoice.id as number;

    const invoiceShare = await request(app)
      .post(`/api/money/invoices/${invoiceId}/share-message`)
      .set(auth)
      .send({ markSent: true });
    expect(invoiceShare.status).toBe(200);
    expect(invoiceShare.body.data.link).toContain("/portal/");
    expect(invoiceShare.body.data.text).toContain(invoiceShare.body.data.link);
    expect(invoiceShare.body.data.status).toBe("SENT");

    const invoicePdf = await request(app)
      .get(`/api/money/invoices/${invoiceId}/pdf`)
      .set(auth);
    expect(invoicePdf.status).toBe(200);
    expect(invoicePdf.headers["content-type"]).toContain("application/pdf");

    const portalPdf = await request(app).get(
      `/api/portal/${invoiceShare.body.data.token}/invoices/${invoiceId}/pdf`,
    );
    expect(portalPdf.status).toBe(200);
    expect(portalPdf.headers["content-type"]).toContain("application/pdf");

    await request(app).delete(`/api/money/invoices/${invoiceId}`).set(auth);
    await request(app).delete(`/api/jobs/${jobId}`).set(auth);
    await request(app).delete(`/api/quotations/${quoteId}`).set(auth);
    await request(app).delete(`/api/clients/${clientId}`).set(auth);
  });

  it("dashboard summary and pricing hub", async () => {
    expect(email).toBeTruthy();
    expect(password).toBeTruthy();

    const login = await request(app).post("/api/auth/login").send({
      email,
      password,
    });
    expect(login.status).toBe(200);
    const auth = { Authorization: `Bearer ${login.body.data.accessToken}` };

    const dashboard = await request(app).get("/api/dashboard").set(auth);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.kpis).toMatchObject({
      expectedIncome: expect.any(String),
      bookedAhead: expect.any(Number),
      averagePerClient: expect.any(String),
      cancellations: expect.any(Number),
    });
    expect(dashboard.body.data.quotations.byStatus).toBeTruthy();
    expect(Array.isArray(dashboard.body.data.nextSessions)).toBe(true);

    expect(dashboard.body.data.profit).toMatchObject({
      income: expect.any(String),
      expenses: expect.any(String),
      net: expect.any(String),
      currency: expect.any(String),
    });
    expect(Array.isArray(dashboard.body.data.cashflow)).toBe(true);
    expect(Array.isArray(dashboard.body.data.leads)).toBe(true);
    expect(Array.isArray(dashboard.body.data.attention)).toBe(true);

    const hub = await request(app).get("/api/pricing").set(auth);
    expect(hub.status).toBe(200);
    expect(hub.body.data).toHaveProperty("opex");
    expect(hub.body.data).toHaveProperty("targets");
    expect(Array.isArray(hub.body.data.savedCalcs)).toBe(true);

    const targets = await request(app)
      .put("/api/pricing/targets")
      .set(auth)
      .send({ jobsPerMonth: 8, avgPrice: 1500, profitGoal: 5000 });
    expect(targets.status).toBe(200);
    expect(targets.body.data.targets.jobsPerMonth).toBe(8);

    const calc = await request(app)
      .post("/api/pricing/calcs")
      .set(auth)
      .send({
        name: `Smoke calc ${Date.now()}`,
        sellPrice: 2000,
        directCost: 800,
        verdict: "GOOD",
      });
    expect(calc.status).toBe(201);
    await request(app)
      .delete(`/api/pricing/calcs/${calc.body.data.calc.id}`)
      .set(auth);
  });

  it("dashboard honours period and from/to ranges", async () => {
    expect(email).toBeTruthy();
    expect(password).toBeTruthy();

    const login = await request(app).post("/api/auth/login").send({
      email,
      password,
    });
    expect(login.status).toBe(200);
    const auth = { Authorization: `Bearer ${login.body.data.accessToken}` };

    const week = await request(app)
      .get("/api/dashboard")
      .query({ period: "7" })
      .set(auth);
    expect(week.status).toBe(200);
    expect(week.body.data.range.period).toBe(7);
    const weekSpan =
      new Date(week.body.data.range.to).getTime() -
      new Date(week.body.data.range.from).getTime();
    expect(Math.round(weekSpan / 86_400_000)).toBe(7);
    // One bucket per (partial) week in range.
    expect(week.body.data.cashflow.length).toBeGreaterThanOrEqual(1);
    expect(week.body.data.cashflow[0]).toMatchObject({
      weekStart: expect.any(String),
      in: expect.any(String),
      out: expect.any(String),
    });

    const explicit = await request(app)
      .get("/api/dashboard")
      .query({
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-03-31T23:59:59.000Z",
      })
      .set(auth);
    expect(explicit.status).toBe(200);
    expect(explicit.body.data.range.period).toBeNull();
    expect(explicit.body.data.range.from).toBe("2026-01-01T00:00:00.000Z");

    const badPeriod = await request(app)
      .get("/api/dashboard")
      .query({ period: "45" })
      .set(auth);
    expect(badPeriod.status).toBe(400);

    const backwards = await request(app)
      .get("/api/dashboard")
      .query({ from: "2026-05-01", to: "2026-04-01" })
      .set(auth);
    expect(backwards.status).toBe(400);
  });

  it("portal checkout and CHIP webhook stay closed without credentials", async () => {
    expect(email).toBeTruthy();
    expect(password).toBeTruthy();

    const login = await request(app).post("/api/auth/login").send({
      email,
      password,
    });
    expect(login.status).toBe(200);
    const auth = { Authorization: `Bearer ${login.body.data.accessToken}` };

    const clientRes = await request(app)
      .post("/api/clients")
      .set(auth)
      .send({ name: `Checkout client ${Date.now()}` });
    const clientId = clientRes.body.data.client.id as number;

    const jobRes = await request(app)
      .post("/api/jobs")
      .set(auth)
      .send({
        clientId,
        sessions: [{ label: "Nikah", startsAt: "2026-12-01T02:00:00.000Z" }],
      });
    const jobId = jobRes.body.data.job.id as number;

    const invoice = await request(app)
      .post("/api/money/invoices")
      .set(auth)
      .send({ jobId, milestones: [{ label: "Deposit", amount: 250 }] });
    const invoiceId = invoice.body.data.invoice.id as number;

    const tokenRes = await request(app)
      .post("/api/portal/tokens")
      .set(auth)
      .send({ jobId });
    const token = tokenRes.body.data.token as string;

    // CHIP is off for the seeded studio and credentials are env-gated.
    const checkout = await request(app)
      .post(`/api/portal/${token}/checkout`)
      .send({ invoiceId });
    expect(checkout.status).toBe(503);

    const webhook = await request(app)
      .post("/api/webhooks/chip")
      .set("Content-Type", "application/json")
      .send({ id: "evt_test", event_type: "purchase.paid" });
    expect([401, 503]).toContain(webhook.status);

    await request(app).delete(`/api/money/invoices/${invoiceId}`).set(auth);
    await request(app).delete(`/api/jobs/${jobId}`).set(auth);
    await request(app).delete(`/api/clients/${clientId}`).set(auth);
  });
});
