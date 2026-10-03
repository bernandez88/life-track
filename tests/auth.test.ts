import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { authMiddleware } from "../src/middleware/auth";
import type { AppBindings } from "../src/types";

const createProtectedApp = () => {
  const app = new Hono<{ Bindings: AppBindings }>();
  app.use("*", authMiddleware);
  app.get("/protected", (c) => c.json({ status: "authorized" }));
  return app;
};

const env = { API_AUTH_TOKEN: "local-test-token" } as AppBindings;

describe("Bearer token authentication", () => {
  it("rejects requests without a token", async () => {
    const response = await createProtectedApp().fetch(
      new Request("https://life-track.test/protected"),
      env,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("rejects an invalid token", async () => {
    const response = await createProtectedApp().fetch(
      new Request("https://life-track.test/protected", {
        headers: { Authorization: "Bearer wrong-token" },
      }),
      env,
    );

    expect(response.status).toBe(401);
  });

  it("allows the configured token", async () => {
    const response = await createProtectedApp().fetch(
      new Request("https://life-track.test/protected", {
        headers: { Authorization: "Bearer local-test-token" },
      }),
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "authorized" });
  });
});
