import { createMiddleware } from "hono/factory";
import { createHash } from "node:crypto";
import type { AppEnv } from "../types";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const authMiddleware = createMiddleware<AppEnv>(
  async (c, next) => {
    const authorization = c.req.header("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const providedToken = authorization.slice("Bearer ".length).trim();
    if (!providedToken) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const token = await c.env.DB.prepare(
      "SELECT user_id FROM api_tokens WHERE token_hash = ?1 AND revoked_at IS NULL",
    ).bind(hashToken(providedToken)).first<{ user_id: string }>();

    if (!token) {
      return c.json({ error: "unauthorized" }, 401);
    }

    c.set("userId", token.user_id);

    await next();
  },
);
