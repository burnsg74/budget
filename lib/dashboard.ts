import type { AccountType } from "./account-types";
import { listAccounts, type AccountRecord } from "./accounts";
import { lastDayOfMonth, monthEnd, monthStart, toIsoDate } from "./dates";
import { query } from "./db";

export type CashItem = {
  id: number;
  name: string;
  type: AccountType;
  balanceCents: number;
};

export type UpcomingItem = {
  id: number;
  name: string;
  type: AccountType;
  dueOn: string;
  amountCents: number;
  pastDue: boolean;
  direction: "in" | "out";
};

export type DashboardData = {
  monthLabel: string;
  cashCents: number;
  checking: CashItem[];
  owedCents: number;
  cards: CashItem[];
  loans: CashItem[];
  incomeCents: number;
  spendingCents: number;
  unlinkedCents: number;
  projectedCents: number;
  upcoming: UpcomingItem[];
  hasAccounts: boolean;
  hasTransactions: boolean;
};

type PaidRow = { accountId: number };
type SumRow = { cents: number };

export async function getDashboard(today: Date): Promise<DashboardData> {
  const start = monthStart(today);
  const end = monthEnd(today);
  const todayIso = toIsoDate(today);
  const lastDay = lastDayOfMonth(today);

  const [accounts, paidRows, incomeRows, spendingRows, unlinkedRows, transactionCount] =
    await Promise.all([
      listAccounts(),
      query<PaidRow>(
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
      query<SumRow>(
        `SELECT COALESCE(SUM(t.amount_cents), 0)::bigint AS cents
         FROM transactions t
         JOIN accounts a ON a.id = t.matched_account_id
         WHERE a.type = 'income'
           AND t.status = 'Posted'
           AND t.posted_on BETWEEN $1 AND $2`,
        [start, end],
      ),
      query<SumRow>(
        `SELECT COALESCE(SUM(-t.amount_cents), 0)::bigint AS cents
         FROM transactions t
         JOIN accounts a ON a.id = t.matched_account_id
         WHERE a.type IN ('bill', 'household', 'other')
           AND t.status = 'Posted'
           AND t.posted_on BETWEEN $1 AND $2`,
        [start, end],
      ),
      query<SumRow>(
        `SELECT COALESCE(SUM(-amount_cents) FILTER (WHERE amount_cents < 0), 0)::bigint AS cents
         FROM transactions
         WHERE matched_account_id IS NULL
           AND status = 'Posted'
           AND posted_on BETWEEN $1 AND $2`,
        [start, end],
      ),
      query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM transactions`,
      ),
    ]);

  const paid = new Set(paidRows.map((row) => Number(row.accountId)));
  const active = accounts.filter((account) => !account.archived);
  const checking = active
    .filter((account) => account.type === "checking" && account.balanceCents !== null)
    .map(toCashItem);
  const cards = active
    .filter((account) => account.type === "credit_card" && account.balanceCents !== null)
    .map(toCashItem);
  const loans = active
    .filter((account) => account.type === "loan" && account.balanceCents !== null)
    .map(toCashItem);

  const cashCents = checking.reduce((sum, item) => sum + item.balanceCents, 0);
  const owedCents = [...cards, ...loans].reduce(
    (sum, item) => sum - item.balanceCents,
    0,
  );

  const upcoming = listUpcoming(active, paid, start, lastDay, todayIso);

  const projectedCents = upcoming.reduce((sum, item) => {
    return item.direction === "in" ? sum + item.amountCents : sum - item.amountCents;
  }, cashCents);

  return {
    monthLabel: new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(today),
    cashCents,
    checking,
    owedCents,
    cards,
    loans,
    incomeCents: Number(incomeRows[0]?.cents ?? 0),
    spendingCents: Number(spendingRows[0]?.cents ?? 0),
    unlinkedCents: Number(unlinkedRows[0]?.cents ?? 0),
    projectedCents,
    upcoming,
    hasAccounts: accounts.length > 0,
    hasTransactions: Number(transactionCount[0]?.count ?? 0) > 0,
  };
}

export function listUpcoming(
  accounts: AccountRecord[],
  paid: Set<number>,
  start: string,
  lastDay: number,
  todayIso: string,
): UpcomingItem[] {
  return accounts
    .filter(
      (account) =>
        !account.archived &&
        account.scheduleActive &&
        account.expectedAmountCents !== null &&
        account.dueDay !== null &&
        !paid.has(account.id) &&
        (account.type === "income" ||
          account.type === "bill" ||
          account.type === "credit_card" ||
          account.type === "loan"),
    )
    .map((account) => {
      const dueDay = Math.min(account.dueDay ?? 1, lastDay);
      const dueOn = `${start.slice(0, 8)}${String(dueDay).padStart(2, "0")}`;
      const direction = account.type === "income" ? "in" : "out";
      return {
        id: account.id,
        name: account.name,
        type: account.type,
        dueOn,
        amountCents: account.expectedAmountCents ?? 0,
        pastDue: dueOn < todayIso,
        direction,
      } satisfies UpcomingItem;
    })
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.name.localeCompare(b.name));
}

function toCashItem(account: AccountRecord): CashItem {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    balanceCents: account.balanceCents ?? 0,
  };
}
