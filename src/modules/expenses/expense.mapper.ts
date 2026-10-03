import type { ExpenseResponse, ExpenseRow } from "./expense.types";

export const toExpenseResponse = (row: ExpenseRow): ExpenseResponse => ({
  ...row,
  amount: row.amount / 100,
});
