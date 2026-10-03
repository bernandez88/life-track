import { createMiddleware } from "hono/factory";
import type { AppBindings } from "../types";

export const authMiddleware = createMiddleware<{ Bindings: AppBindings }>(
  async (c, next) => {
    const authorization = c.req.header("Authorization");
    const configuredToken = c.env.API_AUTH_TOKEN;

    if (!configuredToken || !authorization?.startsWith("Bearer ")) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const providedToken = authorization.slice("Bearer ".length).trim();
    if (!providedToken || providedToken !== configuredToken) {
      return c.json({ error: "unauthorized" }, 401);
    }

    await next();
  },
);
