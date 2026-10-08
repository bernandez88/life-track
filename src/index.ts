import { Hono } from "hono";
import { authMiddleware } from "./middleware/auth";
import { activityRoutes } from "./modules/activities/activity.routes";
import { createCatalogRoutes } from "./modules/catalogs/catalog.routes";
import { expenseRoutes } from "./modules/expenses/expense.routes";
import { noteRoutes } from "./modules/notes/note.routes";
import { workoutRoutes } from "./modules/workouts/workout.routes";
import { errorHandler } from "./shared/error-handler";
import type { AppEnv } from "./types";

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

export default app;
