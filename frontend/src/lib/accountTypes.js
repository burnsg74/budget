export const ACCOUNT_TYPES = ["checking", "income", "credit_card", "loan", "bill", "household", "other"];

export const TYPE_LABELS = {
  checking: "Checking",
  income: "Income",
  credit_card: "Credit Card",
  loan: "Loan",
  bill: "Bill",
  household: "Household",
  other: "Other",
};

// Home sections, in display order. Labels follow the spec ("House Hold").
export const SECTIONS = [
  { type: "income", label: "Income" },
  { type: "bill", label: "Bills" },
  { type: "credit_card", label: "Credit Cards" },
  { type: "loan", label: "Loans" },
  { type: "household", label: "House Hold" },
  { type: "other", label: "Other" },
];

const BALANCE = new Set(["checking", "credit_card", "loan"]);
const LIABILITY = new Set(["credit_card", "loan"]);
const SCHEDULE = new Set(["income", "bill", "credit_card", "loan"]);
const SPENDING = new Set(["bill", "household", "other"]);

export const isBalanceType = (type) => BALANCE.has(type);
export const isLiabilityType = (type) => LIABILITY.has(type);
export const isScheduleType = (type) => SCHEDULE.has(type);
export const isSpendingType = (type) => SPENDING.has(type);
