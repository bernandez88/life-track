import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const worker = exports as unknown as {
  default: { fetch(request: Request): Promise<Response> };
};

describe("health endpoint", () => {
  it("returns a healthy service response", async () => {
    const response = await worker.default.fetch(new Request("https://life-track.test/health"));
    const body = await response.json<{ status: string; service: string }>();

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({
      status: "ok",
      service: "life-track-api",
    }));
  });

  it("also exposes the versioned API health route", async () => {
    const response = await worker.default.fetch(new Request("https://life-track.test/api/v1/health"));

    expect(response.status).toBe(200);
  });

  it("returns a consistent JSON 404 for unknown routes", async () => {
    const response = await worker.default.fetch(new Request("https://life-track.test/api/v1/unknown"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
  });
});
