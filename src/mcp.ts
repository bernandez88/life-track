import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler, getMcpAuthContext } from "agents/mcp/server";
import { z } from "zod";
import { authenticateRequest } from "./middleware/auth";
import { ActivityRepository } from "./modules/activities/activity.repository";
import { ActivityService } from "./modules/activities/activity.service";
import { createActivitySchema, listActivitiesSchema } from "./modules/activities/activity.schemas";
import { ExpenseRepository } from "./modules/expenses/expense.repository";
import { ExpenseService } from "./modules/expenses/expense.service";
import { createExpenseSchema, listExpensesSchema } from "./modules/expenses/expense.schemas";
import { NoteRepository } from "./modules/notes/note.repository";
import { NoteService } from "./modules/notes/note.service";
import { createNoteSchema, listNotesSchema } from "./modules/notes/note.schemas";
import { WorkoutRepository } from "./modules/workouts/workout.repository";
import { WorkoutService } from "./modules/workouts/workout.service";
import { createWorkoutSchema, listWorkoutsSchema } from "./modules/workouts/workout.schemas";

type McpContext = {
  DB: D1Database;
  userId: string | (() => string);
};

const currentUserId = (context: McpContext) =>
  typeof context.userId === "function" ? context.userId() : context.userId;

const jsonResult = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
});

const registerCatalogTool = (
  server: McpServer,
  context: McpContext,
  kind: "expense_categories" | "activity_types",
) => {
  const label = kind === "expense_categories" ? "expense categories" : "activity types";
  const toolName = kind === "expense_categories" ? "list_expense_categories" : "list_activity_types";

  server.registerTool(
    toolName,
    {
      description: `List the current user's active ${label}. Use an id from this list when creating a related record.`,
      inputSchema: { active_only: z.boolean().default(true) },
    },
    async ({ active_only }) => {
      const where = active_only ? "AND active = 1" : "";
      const rows = await context.DB.prepare(
        `SELECT id, name, active FROM ${kind} WHERE user_id = ?1 ${where} ORDER BY name`,
      ).bind(currentUserId(context)).all();
      return jsonResult({ data: rows.results });
    },
  );
};

export const createLifeTrackMcpServer = (context: McpContext) => {
  const server = new McpServer({ name: "life-track", version: "0.1.0" });
  const expenses = new ExpenseService(new ExpenseRepository(context.DB));
  const activities = new ActivityService(new ActivityRepository(context.DB));
  const workouts = new WorkoutService(new WorkoutRepository(context.DB));
  const notes = new NoteService(new NoteRepository(context.DB));

  registerCatalogTool(server, context, "expense_categories");
  registerCatalogTool(server, context, "activity_types");

  server.registerTool(
    "list_expenses",
    {
      description: "List the authenticated user's expenses, optionally filtered by dates or category.",
      inputSchema: listExpensesSchema.shape,
    },
    async (input) => jsonResult(await expenses.list(currentUserId(context), input)),
  );

  server.registerTool(
    "create_expense",
    {
      description: "Create an expense for the authenticated user. Amount is expressed in normal currency units, for example 25.05.",
      inputSchema: createExpenseSchema.shape,
    },
    async (input) => jsonResult({ data: await expenses.create(currentUserId(context), input) }),
  );

  server.registerTool(
    "list_activities",
    {
      description: "List the authenticated user's activities, optionally filtered by dates or activity type.",
      inputSchema: listActivitiesSchema.shape,
    },
    async (input) => jsonResult(await activities.list(currentUserId(context), input)),
  );

  server.registerTool(
    "create_activity",
    {
      description: "Create an activity for the authenticated user.",
      inputSchema: createActivitySchema.shape,
    },
    async (input) => jsonResult({ data: await activities.create(currentUserId(context), input) }),
  );

  server.registerTool(
    "list_workouts",
    {
      description: "List the authenticated user's individual workout exercises, optionally filtered by dates or exercise name.",
      inputSchema: listWorkoutsSchema.shape,
    },
    async (input) => jsonResult(await workouts.list(currentUserId(context), input)),
  );

  server.registerTool(
    "create_workout",
    {
      description: "Create an individual workout exercise for the authenticated user.",
      inputSchema: createWorkoutSchema.shape,
    },
    async (input) => jsonResult({ data: await workouts.create(currentUserId(context), input) }),
  );

  server.registerTool(
    "list_notes",
    {
      description: "List the authenticated user's notes, optionally filtered by text or tag.",
      inputSchema: listNotesSchema.shape,
    },
    async (input) => jsonResult(await notes.list(currentUserId(context), input)),
  );

  server.registerTool(
    "create_note",
    {
      description: "Create a note for the authenticated user, optionally with tags.",
      inputSchema: createNoteSchema.shape,
    },
    async (input) => jsonResult({ data: await notes.create(currentUserId(context), input) }),
  );

  return server;
};

export const createMcpRequestHandler = (request: Request, env: { DB: D1Database }, ctx: ExecutionContext) => {
  return authenticateRequest(request, env.DB).then((userId) => {
    if (!userId) return new Response("Unauthorized", { status: 401 });

    return createMcpHandler(
      () => createLifeTrackMcpServer({ DB: env.DB, userId }),
      { route: "/mcp", responseMode: "json", legacy: "stateless" },
    )(request, env, ctx);
  });
};

export const mcpApiHandler = {
  fetch(request: Request, env: { DB: D1Database }, ctx: ExecutionContext) {
    return createMcpHandler(
      () => createLifeTrackMcpServer({
        DB: env.DB,
        userId: () => String(getMcpAuthContext()?.props.userId ?? ""),
      }),
      { route: "/mcp", responseMode: "json", legacy: "stateless" },
    )(request, env, ctx);
  },
};
