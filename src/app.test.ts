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
