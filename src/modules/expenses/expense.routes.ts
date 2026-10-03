import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { ExpenseRepository } from "./expense.repository";
import { createExpenseSchema, listExpensesSchema, updateExpenseSchema } from "./expense.schemas";
import { ExpenseService } from "./expense.service";

export const expenseRoutes = new Hono<AppEnv>();

expenseRoutes.post("/", zValidator("json", createExpenseSchema), async (c) => {
  const result = await new ExpenseService(new ExpenseRepository(c.env.DB)).create(c.get("userId"), c.req.valid("json"));
  return c.json({ data: result }, 201);
});

expenseRoutes.get("/", zValidator("query", listExpensesSchema), async (c) => {
  const result = await new ExpenseService(new ExpenseRepository(c.env.DB)).list(c.get("userId"), c.req.valid("query"));
  return c.json(result);
});

expenseRoutes.get("/:id", async (c) => {
  const result = await new ExpenseService(new ExpenseRepository(c.env.DB)).get(c.get("userId"), c.req.param("id"));
  return c.json({ data: result });
});

expenseRoutes.patch("/:id", zValidator("json", updateExpenseSchema), async (c) => {
  const result = await new ExpenseService(new ExpenseRepository(c.env.DB)).update(c.get("userId"), c.req.param("id"), c.req.valid("json"));
  return c.json({ data: result });
});

expenseRoutes.delete("/:id", async (c) => {
  await new ExpenseService(new ExpenseRepository(c.env.DB)).delete(c.get("userId"), c.req.param("id"));
  return c.json({ data: { id: c.req.param("id") } });
});
