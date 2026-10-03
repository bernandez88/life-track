export type ExpenseRow = {
  id: string;
  occurred_at: string;
  amount: number;
  currency: string;
  category_id: string;
  category_name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpenseResponse = Omit<ExpenseRow, "amount"> & {
  amount: number;
};
