export type FinanceAccountType =
  | "checking"
  | "wallet"
  | "savings"
  | "credit_card"
  | "cash"
  | "investment";

export type FinanceTransactionType = "income" | "expense" | "transfer";
export type FinanceRecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";
export type FinanceDebtStatus = "open" | "renegotiated" | "paid" | "canceled";

export type FinanceCategoryKind = "income" | "expense" | "both";

export type FinanceAccount = {
  id: string;
  user_id: string;
  name: string;
  type: FinanceAccountType;
  currency: string;
  opening_balance_cents: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type FinanceCategory = {
  id: string;
  user_id: string;
  name: string;
  kind: FinanceCategoryKind;
  parent_id: string | null;
  color: string | null;
  icon: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type FinanceTag = {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceAttachment = {
  id: string;
  user_id: string;
  transaction_id: string;
  bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export type FinanceTransaction = {
  id: string;
  user_id: string;
  type: FinanceTransactionType;
  account_id: string;
  category_id: string | null;
  transfer_group_id: string | null;
  recurring_rule_id: string | null;
  installment_group_id?: string | null;
  installment_number?: number | null;
  installment_total?: number | null;
  debt_id?: string | null;
  amount_cents: number;
  occurred_on: string;
  due_on: string | null;
  description: string | null;
  notes: string | null;
  is_cleared: boolean;
  created_at: string;
  updated_at: string;
};

export type FinanceBudget = {
  id: string;
  user_id: string;
  name: string;
  period_start: string;
  period_end: string;
  amount_limit_cents: number;
  category_id: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceRecurringRule = {
  id: string;
  user_id: string;
  title: string;
  type: FinanceTransactionType;
  account_id: string;
  category_id: string | null;
  amount_cents: number;
  freq: FinanceRecurrenceFreq;
  interval_count: number;
  start_on: string;
  end_on: string | null;
  next_run_at: string;
  last_run_at: string | null;
  timezone: string;
  auto_create_days_ahead: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type FinanceTransactionSplitInput = {
  category_id: string;
  amount_cents: number;
  note?: string;
};

export type FinanceTransactionInput = {
  accessToken: string;
  type: FinanceTransactionType;
  account_id: string;
  destination_account_id?: string;
  amount_cents: number;
  occurred_on: string;
  due_on?: string;
  description?: string;
  notes?: string;
  category_id?: string;
  debt_id?: string;
  installment_count?: number;
  tag_ids?: string[];
  splits?: FinanceTransactionSplitInput[];
};

export type FinanceCreditCardProfile = {
  id: string;
  user_id: string;
  account_id: string;
  closing_day: number;
  due_day: number;
  credit_limit_cents: number | null;
  current_due_cents: number;
  best_purchase_day: number | null;
  created_at: string;
  updated_at: string;
};

export type FinanceDebt = {
  id: string;
  user_id: string;
  name: string;
  creditor: string | null;
  total_amount_cents: number;
  outstanding_cents: number;
  interest_rate_monthly: number | null;
  due_on: string | null;
  status: FinanceDebtStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ActionResult<T = undefined> = {
  ok: boolean;
  error?: string;
  data?: T;
};
