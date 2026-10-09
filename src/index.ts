import { Hono } from "hono";
import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { backupD1ToR2 } from "./backups/d1-backup";
import { authMiddleware } from "./middleware/auth";
import { handleMcpAuth } from "./mcp-auth";
import { mcpApiHandler } from "./mcp";
import { activityRoutes } from "./modules/activities/activity.routes";
import { createCatalogRoutes } from "./modules/catalogs/catalog.routes";
import { expenseRoutes } from "./modules/expenses/expense.routes";
import { noteRoutes } from "./modules/notes/note.routes";
import { workoutRoutes } from "./modules/workouts/workout.routes";
import { createMcpRequestHandler } from "./mcp";
import { errorHandler } from "./shared/error-handler";
import type { AppBindings, AppEnv } from "./types";

const health = (c: { json: (body: unknown) => Response }) =>
  c.json({
    status: "ok",
    service: "life-track-api",
    timestamp: new Date().toISOString(),
  });

const api = new Hono<AppEnv>();
api.get("/health", health);
api.route("/expenses", expenseRoutes);
api.route("/expense-categories", createCatalogRoutes("expenseCategories"));
api.route("/activity-types", createCatalogRoutes("activityTypes"));
api.route("/activities", activityRoutes);
api.route("/workouts", workoutRoutes);
api.route("/notes", noteRoutes);

const app = new Hono<AppEnv>();
app.onError(errorHandler);
app.use("/api/v1/*", async (c, next) => {
  if (c.req.path === "/api/v1/health") {
    return next();
  }

  return authMiddleware(c, next);
});
app.get("/health", health);
app.route("/api/v1", api);

app.notFound((c) => c.json({ error: "not_found" }, 404));

const resourceUrl = "https://life-track-api.bernandez88.workers.dev/mcp";

export default new OAuthProvider<AppBindings>({
  apiRoute: "/mcp",
  apiHandler: mcpApiHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  scopesSupported: ["life-track:read", "life-track:write", "offline_access"],
  requiredScopes: ["life-track:read"],
  resourceMetadata: {
    resource: resourceUrl,
    authorization_servers: ["https://life-track-api.bernandez88.workers.dev"],
  },
  defaultHandler: {
    async fetch(request, env, ctx) {
      const authResponse = await handleMcpAuth(request, env as AppBindings & { OAUTH_PROVIDER: import("@cloudflare/workers-oauth-provider").OAuthHelpers }, ctx);
      return authResponse ?? app.fetch(request, env, ctx);
    },
  },
});

export const scheduled: ExportedHandlerScheduledHandler<AppBindings> = async (_controller, env) => {
  await backupD1ToR2(env.DB, env.BACKUPS);
};
