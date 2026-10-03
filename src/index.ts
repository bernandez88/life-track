import { Hono } from "hono";
import { authMiddleware } from "./middleware/auth";
import type { AppEnv } from "./types";

const health = (c: { json: (body: unknown) => Response }) =>
  c.json({
    status: "ok",
    service: "life-track-api",
    timestamp: new Date().toISOString(),
  });

const api = new Hono<AppEnv>();
api.get("/health", health);

const app = new Hono<AppEnv>();
app.use("/api/v1/*", async (c, next) => {
  if (c.req.path === "/api/v1/health") {
    return next();
  }

  return authMiddleware(c, next);
});
app.get("/health", health);
app.route("/api/v1", api);

app.notFound((c) => c.json({ error: "not_found" }, 404));

export default app;
