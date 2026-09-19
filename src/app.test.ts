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

    const stub2fa = await request(app).post("/api/account/2fa/enroll").set(auth).send({});
    expect(stub2fa.status).toBe(501);
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
});
