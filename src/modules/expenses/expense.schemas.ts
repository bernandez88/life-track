import { z } from "zod";

const money = z.number().finite().nonnegative().refine(
  (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
  "amount must have at most two decimal places",
);
const dateString = z.string().trim().min(1).max(40).refine(
  (value) => !Number.isNaN(Date.parse(value)),
  "must be a valid date",
);

export const createExpenseSchema = z.object({
  occurred_at: dateString,
  amount: money,
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).default("USD"),
  category_id: z.string().trim().min(1),
  description: z.string().trim().max(500).nullable().optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "at least one field is required",
);

export const listExpensesSchema = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
  category_id: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ListExpensesInput = z.infer<typeof listExpensesSchema>;
