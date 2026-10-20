import type { AccountType } from "./account-types";
import { listAccounts } from "./accounts";
import { listUpcoming } from "./dashboard";
import { formatDate, formatMonthLong, monthBounds, shiftMonth, toIsoDate } from "./dates";
import { query } from "./db";

export type RegisterRow = {
  id: string;
  href: string;
  sortKey: string;
  date: string;
  accountId: number | null;
  account: string;
  description: string;
  type: string;
  amountCents: number;
  balanceCents: number;
  estimated: boolean;
};

export type ExpenseSlice = {
  label: string;
  cents: number;
};

export type LiabilityItem = {
  id: number;
  name: string;
  owedCents: number;
};

export type RegisterData = {
  month: string;
  label: string;
  transactionCount: number;
  estimatedCount: number;
  rows: RegisterRow[];
  liabilities: LiabilityItem[];
  incomeCents: number;
  expenses: ExpenseSlice[];
};

type MonthTransaction = {
  id: number;
  postedOn: string;
  description: string;
  amountCents: number;
  accountId: number;
  createdAt: string;
  sourceType: AccountType;
  matchedAccountId: number | null;
  matchedName: string | null;
  matchedType: AccountType | null;
};

const REGISTER_TYPES: Record<AccountType, string> = {
  checking: "Checking",
  income: "Income",
  credit_card: "Credit Cards",
  loan: "Loans",
  bill: "Bills",
  household: "Household",
  other: "Other",
};

const EXPENSE_LABELS: Record<string, string> = {
  bill: "Bills",
  household: "Household",
  credit_card: "Credit Cards",
  loan: "Loans",
  other: "Unspecified",
};

function registerType(type: AccountType | null): string {
  return type ? REGISTER_TYPES[type] : "—";
}

export async function getRegister(month: string, today: Date): Promise<RegisterData> {
  const { start, end, lastDay } = monthBounds(month);
  const todayIso = toIsoDate(today);
  const [accounts, transactions, paidRows, cashRows] = await Promise.all([
    listAccounts(),
    query<MonthTransaction>(
      `SELECT
        t.id,
        t.posted_on AS "postedOn",
        t.description,
        t.amount_cents AS "amountCents",
        t.account_id AS "accountId",
        to_char(t.created_at, 'YYYY-MM-DD HH24:MI:SS.US') AS "createdAt",
        src.type AS "sourceType",
        m.id AS "matchedAccountId",
        m.name AS "matchedName",
        m.type AS "matchedType"
      FROM transactions t
      JOIN accounts src ON src.id = t.account_id
      LEFT JOIN accounts m ON m.id = t.matched_account_id
      WHERE t.status = 'Posted'
        AND t.posted_on BETWEEN $1 AND $2
      ORDER BY t.posted_on, t.created_at, t.id`,
      [start, end],
    ),
    query<{ accountId: number }>(
      `SELECT DISTINCT account_id AS "accountId"
       FROM (
         SELECT matched_account_id AS account_id
         FROM transactions
         WHERE matched_account_id IS NOT NULL
           AND status = 'Posted'
           AND posted_on BETWEEN $1 AND $2
         UNION
         SELECT account_id
         FROM transactions
         WHERE status = 'Posted'
           AND posted_on BETWEEN $1 AND $2
       ) paid`,
      [start, end],
    ),
    query<{ cents: number }>(
      `SELECT COALESCE(SUM(
         a.opening_balance_cents + COALESCE((
           SELECT SUM(t.amount_cents)
           FROM transactions t
           WHERE t.account_id = a.id
             AND t.status = 'Posted'
             AND t.posted_on > a.opening_on
             AND t.posted_on < $1
         ), 0)
       ), 0)::bigint AS cents
       FROM accounts a
       WHERE a.type = 'checking'
         AND NOT a.archived
         AND a.opening_on IS NOT NULL`,
      [start],
    ),
  ]);

  const checkingIds = new Set(
    accounts.filter((account) => account.type === "checking" && !account.archived).map((account) => account.id),
  );
  const upcoming = listUpcoming(
    accounts,
    new Set(paidRows.map((row) => Number(row.accountId))),
    start,
    lastDay,
    todayIso,
  );
  const mapped = transactions.map((transaction) => ({
    ...transaction,
    id: Number(transaction.id),
    amountCents: Number(transaction.amountCents),
    accountId: Number(transaction.accountId),
    matchedAccountId:
      transaction.matchedAccountId === null ? null : Number(transaction.matchedAccountId),
  }));

  let cash = Number(cashRows[0]?.cents ?? 0);
  const events = [
    ...mapped.map((transaction) => ({
      sortKey: `${transaction.postedOn}T0${transaction.createdAt}${String(transaction.id).padStart(8, "0")}`,
      affectsCash: checkingIds.has(transaction.accountId) ? transaction.amountCents : 0,
      row: {
        id: String(transaction.id),
        href: `/transactions/${transaction.id}/edit`,
        date: formatDate(transaction.postedOn),
        accountId: transaction.matchedAccountId,
        account: transaction.matchedName ?? "",
        description: transaction.description,
        type: registerType(transaction.matchedType),
        amountCents: transaction.amountCents,
        estimated: false,
      },
    })),
    ...upcoming.map((item) => ({
      sortKey: `${item.dueOn}T1${item.name}`,
      affectsCash: item.direction === "in" ? item.amountCents : -item.amountCents,
      row: {
        id: `e-${item.id}`,
        href: `/accounts/${item.id}`,
        date: formatDate(item.dueOn),
        accountId: item.id,
        account: item.name,
        description: "Expected",
        type: registerType(item.type),
        amountCents: item.direction === "in" ? item.amountCents : -item.amountCents,
        estimated: true,
      },
    })),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const rows: RegisterRow[] = events.map((event) => {
    cash += event.affectsCash;
    return { ...event.row, sortKey: event.sortKey, balanceCents: cash };
  });
  rows.reverse();

  const liabilities = accounts
    .filter(
      (account) =>
        !account.archived &&
        (account.type === "credit_card" || account.type === "loan") &&
        account.balanceCents !== null,
    )
    .map((account) => ({
      id: account.id,
      name: account.name,
      owedCents: -(account.balanceCents ?? 0),
    }))
    .filter((item) => item.owedCents > 0)
    .sort((a, b) => b.owedCents - a.owedCents || a.name.localeCompare(b.name));

  const incomeCents = mapped.reduce((sum, transaction) => {
    return transaction.matchedType === "income" ? sum + transaction.amountCents : sum;
  }, 0);
  const expenseTotals = new Map<string, number>();

  for (const transaction of mapped) {
    if (transaction.matchedType === "income") {
      continue;
    }

    const label =
      transaction.matchedType && transaction.matchedType in EXPENSE_LABELS
        ? EXPENSE_LABELS[transaction.matchedType]
        : transaction.amountCents < 0
          ? "Unspecified"
          : null;

    if (!label) {
      continue;
    }

    expenseTotals.set(label, (expenseTotals.get(label) ?? 0) - transaction.amountCents);
  }

  const expenses = ["Bills", "Household", "Credit Cards", "Loans", "Unspecified"]
    .map((label) => ({ label, cents: expenseTotals.get(label) ?? 0 }))
    .filter((slice) => slice.cents > 0);

  return {
    month,
    label: formatMonthLong(month),
    transactionCount: mapped.length,
    estimatedCount: upcoming.length,
    rows,
    liabilities,
    incomeCents,
    expenses,
  };
}

export function adjacentMonths(month: string): { previous: string; next: string } {
  return { previous: shiftMonth(month, -1), next: shiftMonth(month, 1) };
}
