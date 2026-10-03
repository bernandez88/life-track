import type { CreateExpenseInput, ListExpensesInput, UpdateExpenseInput } from "./expense.schemas";
import type { ExpenseRow } from "./expense.types";

const select = `
  SELECT e.id, e.occurred_at, e.amount, e.currency, e.category_id,
         c.name AS category_name, e.description, e.created_at, e.updated_at
  FROM expenses e
  JOIN expense_categories c ON c.id = e.category_id AND c.user_id = e.user_id
`;

export class ExpenseRepository {
  constructor(private readonly db: D1Database) {}

  async categoryBelongsToUser(userId: string, categoryId: string): Promise<boolean> {
    const row = await this.db.prepare(
      "SELECT id FROM expense_categories WHERE id = ?1 AND user_id = ?2 AND active = 1",
    ).bind(categoryId, userId).first<{ id: string }>();
    return Boolean(row);
  }

  async create(userId: string, input: CreateExpenseInput, amountCents: number, id: string, timestamp: string): Promise<ExpenseRow> {
    await this.db.prepare(
      `INSERT INTO expenses (id, user_id, occurred_at, amount, currency, category_id, description, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)`,
    ).bind(id, userId, input.occurred_at, amountCents, input.currency, input.category_id, input.description ?? null, timestamp).run();
    return (await this.findById(userId, id))!;
  }

  async findById(userId: string, id: string): Promise<ExpenseRow | null> {
    return this.db.prepare(`${select} WHERE e.user_id = ?1 AND e.id = ?2`).bind(userId, id).first<ExpenseRow>();
  }

  async list(userId: string, input: ListExpensesInput): Promise<ExpenseRow[]> {
    const conditions = ["e.user_id = ?1"];
    const values: unknown[] = [userId];
    let index = 2;
    if (input.from) { conditions.push(`e.occurred_at >= ?${index}`); values.push(input.from); index++; }
    if (input.to) { conditions.push(`e.occurred_at <= ?${index}`); values.push(input.to); index++; }
    if (input.category_id) { conditions.push(`e.category_id = ?${index}`); values.push(input.category_id); index++; }
    values.push(input.limit, input.offset);
    return (await this.db.prepare(
      `${select} WHERE ${conditions.join(" AND ")} ORDER BY e.occurred_at DESC, e.created_at DESC LIMIT ?${index} OFFSET ?${index + 1}`,
    ).bind(...values).all<ExpenseRow>()).results;
  }

  async update(userId: string, id: string, input: UpdateExpenseInput, amountCents: number | undefined, timestamp: string): Promise<ExpenseRow | null> {
    const current = await this.findById(userId, id);
    if (!current) return null;
    await this.db.prepare(
      `UPDATE expenses
       SET occurred_at = ?1, amount = ?2, currency = ?3, category_id = ?4, description = ?5, updated_at = ?6
       WHERE user_id = ?7 AND id = ?8`,
    ).bind(
      input.occurred_at ?? current.occurred_at,
      amountCents ?? current.amount,
      input.currency ?? current.currency,
      input.category_id ?? current.category_id,
      input.description === undefined ? current.description : input.description,
      timestamp,
      userId,
      id,
    ).run();
    return this.findById(userId, id);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.db.prepare("DELETE FROM expenses WHERE user_id = ?1 AND id = ?2").bind(userId, id).run();
    return result.meta.changes > 0;
  }
}
