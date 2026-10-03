import { badRequest, notFound } from "../../shared/errors";
import { toExpenseResponse } from "./expense.mapper";
import type { CreateExpenseInput, ListExpensesInput, UpdateExpenseInput } from "./expense.schemas";
import { ExpenseRepository } from "./expense.repository";

const toCents = (amount: number) => Math.round(amount * 100);
const normalizeDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw badRequest("occurred_at must be a valid date");
  return date.toISOString();
};

export class ExpenseService {
  constructor(private readonly repository: ExpenseRepository) {}

  async create(userId: string, input: CreateExpenseInput) {
    if (!await this.repository.categoryBelongsToUser(userId, input.category_id)) {
      throw notFound("Expense category not found");
    }
    const row = await this.repository.create(userId, { ...input, occurred_at: normalizeDate(input.occurred_at) }, toCents(input.amount), crypto.randomUUID(), new Date().toISOString());
    return toExpenseResponse(row);
  }

  async list(userId: string, input: ListExpensesInput) {
    const rows = await this.repository.list(userId, input);
    return {
      data: rows.map(toExpenseResponse),
      pagination: { limit: input.limit, offset: input.offset, has_more: rows.length === input.limit },
    };
  }

  async get(userId: string, id: string) {
    const row = await this.repository.findById(userId, id);
    if (!row) throw notFound("Expense not found");
    return toExpenseResponse(row);
  }

  async update(userId: string, id: string, input: UpdateExpenseInput) {
    if (input.category_id && !await this.repository.categoryBelongsToUser(userId, input.category_id)) {
      throw notFound("Expense category not found");
    }
    const row = await this.repository.update(userId, id, {
      ...input,
      occurred_at: input.occurred_at ? normalizeDate(input.occurred_at) : undefined,
    }, input.amount === undefined ? undefined : toCents(input.amount), new Date().toISOString());
    if (!row) throw notFound("Expense not found");
    return toExpenseResponse(row);
  }

  async delete(userId: string, id: string) {
    if (!await this.repository.delete(userId, id)) throw notFound("Expense not found");
  }
}
