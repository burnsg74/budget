export const ACCOUNT_TYPES = [
  "checking",
  "income",
  "credit_card",
  "loan",
  "bill",
  "household",
  "other",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const TYPE_LABELS: Record<AccountType, string> = {
  checking: "Checking",
  income: "Income",
  credit_card: "Credit Card",
  loan: "Loan",
  bill: "Bill",
  household: "Household",
  other: "Other",
};

const BALANCE_TYPES = new Set<AccountType>(["checking", "credit_card", "loan"]);
const LIABILITY_TYPES = new Set<AccountType>(["credit_card", "loan"]);
const SCHEDULE_TYPES = new Set<AccountType>(["income", "bill", "credit_card", "loan"]);
const SPENDING_TYPES = new Set<AccountType>(["bill", "household", "other"]);

export function isAccountType(value: string): value is AccountType {
  return (ACCOUNT_TYPES as readonly string[]).includes(value);
}

export function isBalanceType(type: AccountType): boolean {
  return BALANCE_TYPES.has(type);
}

export function isLiabilityType(type: AccountType): boolean {
  return LIABILITY_TYPES.has(type);
}

export function isScheduleType(type: AccountType): boolean {
  return SCHEDULE_TYPES.has(type);
}

export function isSpendingType(type: AccountType): boolean {
  return SPENDING_TYPES.has(type);
}
