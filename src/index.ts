import { Hono } from "hono";

type Bindings = {
  DB: D1Database;
  API_AUTH_TOKEN: string;
};

const health = (c: { json: (body: unknown) => Response }) =>
  c.json({
    status: "ok",
    service: "life-track-api",
    timestamp: new Date().toISOString(),
  });

const api = new Hono<{ Bindings: Bindings }>();
api.get("/health", health);

const app = new Hono<{ Bindings: Bindings }>();
app.get("/health", health);
app.route("/api/v1", api);

app.notFound((c) => c.json({ error: "not_found" }, 404));

export default app;
