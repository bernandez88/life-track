import { describe, expect, it } from "vitest";
import { toExpenseResponse } from "../src/modules/expenses/expense.mapper";
import { createExpenseSchema } from "../src/modules/expenses/expense.schemas";

describe("expense unit behavior", () => {
  it("validates decimal input while preserving cents precision", () => {
    const parsed = createExpenseSchema.parse({
      occurred_at: "2026-10-01",
      amount: 25.05,
      category_id: "food",
    });

    expect(parsed.amount).toBe(25.05);
    expect(parsed.currency).toBe("USD");
  });

  it("maps integer cents from D1 to a decimal API amount", () => {
    const response = toExpenseResponse({
      id: "expense-1",
      occurred_at: "2026-10-01",
      amount: 2505,
      currency: "USD",
      category_id: "food",
      category_name: "Food",
      description: null,
      created_at: "2026-10-01T12:00:00.000Z",
      updated_at: "2026-10-01T12:00:00.000Z",
    });

    expect(response.amount).toBe(25.05);
  });
});
