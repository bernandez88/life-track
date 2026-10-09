import { describe, expect, it } from "vitest";
import { exports } from "cloudflare:workers";

const worker = exports as unknown as {
  default: { fetch(request: Request): Promise<Response> };
};

describe("life-track MCP endpoint", () => {
  it("requires a bearer token", async () => {
    const response = await worker.default.fetch(new Request("https://life-track.test/mcp"));

    expect(response.status).toBe(401);
  });
});
