import { createMiddleware } from "hono/factory";
import { createHash } from "node:crypto";
import type { AppEnv } from "../types";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const authenticateRequest = async (request: Request, db: D1Database) => {
  const authorization = request.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) return null;

  const providedToken = authorization.slice("Bearer ".length).trim();
  if (!providedToken) return null;

  const token = await db.prepare(
    "SELECT user_id FROM api_tokens WHERE token_hash = ?1 AND revoked_at IS NULL",
  ).bind(hashToken(providedToken)).first<{ user_id: string }>();

  return token?.user_id ?? null;
};

export const authMiddleware = createMiddleware<AppEnv>(
  async (c, next) => {
    const userId = await authenticateRequest(c.req.raw, c.env.DB);

    if (!userId) {
      return c.json({ error: "unauthorized" }, 401);
    }

    c.set("userId", userId);

    await next();
  },
);
