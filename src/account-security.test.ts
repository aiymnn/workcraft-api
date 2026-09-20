import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Secret, TOTP } from "otpauth";
import app from "./app.js";

/**
 * Wave D covers login-scoped security, so these run against a throwaway studio
 * member instead of the seeded system admin whose email other suites log in with.
 */
const adminEmail = process.env.SYSTEM_ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.SYSTEM_ADMIN_PASSWORD;

const memberPassword = "WaveDsecurity123!";
const stamp = Date.now();
const memberEmail = `wave-d-${stamp}@example.com`;
const changedEmail = `wave-d-${stamp}-moved@example.com`;

let adminAuth: { Authorization: string };
let memberId: number;

function totpCode(secret: string) {
  return new TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  }).generate();
}

async function loginAs(email: string, password: string) {
  return request(app).post("/api/auth/login").send({ email, password });
}

beforeAll(async () => {
  expect(adminEmail, "SYSTEM_ADMIN_EMAIL required").toBeTruthy();
  expect(adminPassword, "SYSTEM_ADMIN_PASSWORD required").toBeTruthy();

  const adminLogin = await loginAs(adminEmail!, adminPassword!);
  expect(adminLogin.status).toBe(200);
  adminAuth = { Authorization: `Bearer ${adminLogin.body.data.accessToken}` };

  const created = await request(app)
    .post("/api/team/members")
    .set(adminAuth)
    .send({
      name: "Wave D Security",
      email: memberEmail,
      password: memberPassword,
      access: "ADMIN",
    });
  expect(created.status).toBe(201);
  memberId = created.body.data.member.id as number;
});

afterAll(async () => {
  if (!memberId) return;
  await request(app).delete(`/api/team/members/${memberId}`).set(adminAuth);
});

describe("Wave D — email change", () => {
  it("requires the right password, mails a token, then applies the new email", async () => {
    const login = await loginAs(memberEmail, memberPassword);
    expect(login.status).toBe(200);
    const auth = { Authorization: `Bearer ${login.body.data.accessToken}` };

    const wrongPassword = await request(app)
      .post("/api/account/email")
      .set(auth)
      .send({ newEmail: changedEmail, password: "not-my-password" });
    expect(wrongPassword.status).toBe(401);

    const sameEmail = await request(app)
      .post("/api/account/email")
      .set(auth)
      .send({ newEmail: memberEmail, password: memberPassword });
    expect(sameEmail.status).toBe(400);

    const requested = await request(app)
      .post("/api/account/email")
      .set(auth)
      .send({ newEmail: changedEmail, password: memberPassword });
    expect(requested.status).toBe(200);
    expect(requested.body.data.requested).toBe(true);
    expect(requested.body.data.newEmail).toBe(changedEmail);
    // SMTP is off in tests, so the link comes back for the caller instead.
    expect(requested.body.data.emailSent).toBe(false);
    expect(requested.body.data.confirmUrl).toContain("/account/confirm-email?token=");

    const token = new URL(requested.body.data.confirmUrl).searchParams.get(
      "token",
    )!;
    expect(token.length).toBeGreaterThan(16);

    const badToken = await request(app)
      .post("/api/account/email/confirm")
      .send({ token: "x".repeat(32) });
    expect(badToken.status).toBe(404);

    const confirmed = await request(app)
      .post("/api/account/email/confirm")
      .send({ token });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.email).toBe(changedEmail);

    const reused = await request(app)
      .post("/api/account/email/confirm")
      .send({ token });
    expect(reused.status).toBe(404);

    const relogin = await loginAs(changedEmail, memberPassword);
    expect(relogin.status).toBe(200);
    expect(relogin.body.data.user.email).toBe(changedEmail);
  });
});

describe("Wave D — TOTP two-factor", () => {
  it("enrolls, confirms, challenges at login, then disables", async () => {
    const login = await loginAs(changedEmail, memberPassword);
    expect(login.status).toBe(200);
    const auth = { Authorization: `Bearer ${login.body.data.accessToken}` };

    const enroll = await request(app)
      .post("/api/account/2fa/enroll")
      .set(auth)
      .send({});
    expect(enroll.status).toBe(200);
    const secret = enroll.body.data.secret as string;
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(enroll.body.data.otpauthUrl).toContain("otpauth://totp/Workcraft");
    expect(enroll.body.data.qrDataUrl).toContain("data:image/png;base64,");

    // Pending enrollment must not gate login yet.
    const beforeConfirm = await loginAs(changedEmail, memberPassword);
    expect(beforeConfirm.body.data.accessToken).toBeTruthy();

    const badCode = await request(app)
      .post("/api/account/2fa/confirm")
      .set(auth)
      .send({ code: "000000" });
    expect(badCode.status).toBe(400);

    const confirmed = await request(app)
      .post("/api/account/2fa/confirm")
      .set(auth)
      .send({ code: totpCode(secret) });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.enabled).toBe(true);

    const profile = await request(app).get("/api/account/profile").set(auth);
    expect(profile.body.data.user.totpEnabled).toBe(true);

    const challenged = await loginAs(changedEmail, memberPassword);
    expect(challenged.status).toBe(200);
    expect(challenged.body.data.requires2fa).toBe(true);
    expect(challenged.body.data.accessToken).toBeUndefined();
    const tempToken = challenged.body.data.tempToken as string;

    const wrongStep = await request(app)
      .post("/api/auth/login/2fa")
      .send({ tempToken, code: "000000" });
    expect(wrongStep.status).toBe(401);

    const finished = await request(app)
      .post("/api/auth/login/2fa")
      .send({ tempToken, code: totpCode(secret) });
    expect(finished.status).toBe(200);
    expect(finished.body.data.accessToken).toBeTruthy();
    expect(finished.body.data.studio.id).toEqual(expect.any(Number));

    const secondAuth = {
      Authorization: `Bearer ${finished.body.data.accessToken}`,
    };

    const noProof = await request(app)
      .post("/api/account/2fa/disable")
      .set(secondAuth)
      .send({});
    expect(noProof.status).toBe(400);

    const disabled = await request(app)
      .post("/api/account/2fa/disable")
      .set(secondAuth)
      .send({ password: memberPassword });
    expect(disabled.status).toBe(200);
    expect(disabled.body.data.disabled).toBe(true);

    const plainLogin = await loginAs(changedEmail, memberPassword);
    expect(plainLogin.body.data.accessToken).toBeTruthy();
  });
});

describe("Wave D — sign out everywhere", () => {
  it("revokes every session so existing tokens stop working", async () => {
    const first = await loginAs(changedEmail, memberPassword);
    const second = await loginAs(changedEmail, memberPassword);
    const firstAuth = { Authorization: `Bearer ${first.body.data.accessToken}` };
    const secondAuth = {
      Authorization: `Bearer ${second.body.data.accessToken}`,
    };

    expect((await request(app).get("/api/account/profile").set(firstAuth)).status).toBe(200);

    const revoked = await request(app)
      .post("/api/account/sessions/revoke-all")
      .set(secondAuth);
    expect(revoked.status).toBe(200);
    expect(revoked.body.data.revoked).toBeGreaterThanOrEqual(2);

    const afterFirst = await request(app).get("/api/account/profile").set(firstAuth);
    expect(afterFirst.status).toBe(401);

    const afterSecond = await request(app)
      .get("/api/account/profile")
      .set(secondAuth);
    expect(afterSecond.status).toBe(401);

    const fresh = await loginAs(changedEmail, memberPassword);
    const freshAuth = { Authorization: `Bearer ${fresh.body.data.accessToken}` };
    expect((await request(app).get("/api/account/profile").set(freshAuth)).status).toBe(200);
  });
});

describe("Wave D — Google OAuth and footage flags", () => {
  it("reports Google as unconfigured and still toggles the footage portal", async () => {
    const login = await loginAs(changedEmail, memberPassword);
    const auth = { Authorization: `Bearer ${login.body.data.accessToken}` };

    const start = await request(app)
      .get("/api/account/oauth/google/start?purpose=calendar")
      .set(auth);
    expect(start.status).toBe(503);

    const sync = await request(app)
      .post("/api/account/oauth/google/sync")
      .set(auth)
      .send({ purpose: "calendar" });
    expect(sync.status).toBe(503);

    const on = await request(app)
      .post("/api/account/footage-portal")
      .set(auth)
      .send({ enabled: true });
    expect(on.status).toBe(200);
    expect(on.body.data.connections.footagePortalEnabled).toBe(true);

    const profile = await request(app).get("/api/account/profile").set(auth);
    expect(profile.body.data.connections.footagePortalEnabled).toBe(true);
    expect(profile.body.data.connections.googleConfigured).toBe(false);

    const off = await request(app)
      .post("/api/account/footage-portal")
      .set(auth)
      .send({ enabled: false });
    expect(off.status).toBe(200);
    expect(off.body.data.connections.footagePortalEnabled).toBe(false);
  });
});
