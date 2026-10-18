import { isBalanceType, isSpendingType, type AccountType } from "./account-types";
import { addDays, eachDate, formatDate, formatMonth, isIsoDate, toIsoDate } from "./dates";
import { query } from "./db";

export type ChartPoint = { label: string; cents: number };
export type MonthChartPoint = { label: string; income: number; expenses: number };

export function datePoints(rows: { date: string; cents: number }[]): ChartPoint[] {
  return rows.map((row) => ({ label: formatDate(row.date), cents: row.cents }));
}

export function monthPoints(
  rows: { month: string; incomeCents: number; expenseCents: number }[],
): MonthChartPoint[] {
  return rows.map((row) => ({
    label: formatMonth(row.month),
    income: row.incomeCents,
    expenses: row.expenseCents,
  }));
}

export type DatedCents = { date: string; cents: number };
export type MonthTotals = { month: string; incomeCents: number; expenseCents: number };

type DateSum = { date: string; cents: number };
type MonthSum = { month: string; incomeCents: number; expenseCents: number };

export function defaultReportRange(today: Date): { from: string; to: string } {
  const from = toIsoDate(new Date(today.getFullYear(), today.getMonth() - 11, 1));
  return { from, to: toIsoDate(today) };
}

export function resolveRange(
  fromValue: string | undefined,
  toValue: string | undefined,
  today: Date,
): { from: string; to: string } {
  const fallback = defaultReportRange(today);
  let from = fromValue && isIsoDate(fromValue) ? fromValue : fallback.from;
  let to = toValue && isIsoDate(toValue) ? toValue : fallback.to;

  if (from > to) {
    [from, to] = [to, from];
  }

  return { from, to };
}

export async function spendingSeries(
  accountId: number,
  type: AccountType,
  from: string,
  to: string,
): Promise<DatedCents[]> {
  if (type === "checking") {
    return query<DateSum>(
      `SELECT t.posted_on AS date,
              COALESCE(SUM(-t.amount_cents), 0)::bigint AS cents
       FROM transactions t
       LEFT JOIN accounts matched ON matched.id = t.matched_account_id
       WHERE t.account_id = $1
         AND t.status = 'Posted'
         AND t.posted_on BETWEEN $2 AND $3
         AND t.amount_cents < 0
         AND (matched.type IS NULL OR matched.type NOT IN ('credit_card', 'loan'))
       GROUP BY t.posted_on
       ORDER BY t.posted_on`,
      [accountId, from, to],
    );
  }

  if (isSpendingType(type)) {
    return query<DateSum>(
      `SELECT posted_on AS date,
              COALESCE(SUM(-amount_cents), 0)::bigint AS cents
       FROM transactions
       WHERE matched_account_id = $1
         AND status = 'Posted'
         AND posted_on BETWEEN $2 AND $3
       GROUP BY posted_on
       ORDER BY posted_on`,
      [accountId, from, to],
    );
  }

  return [];
}

export function spendingSeriesApplies(type: AccountType): boolean {
  return type === "checking" || isSpendingType(type);
}

export async function balanceSeries(
  accountId: number,
  type: AccountType,
  openingBalanceCents: number,
  openingOn: string | null,
  from: string,
  to: string,
): Promise<DatedCents[]> {
  if (!isBalanceType(type) || !openingOn) {
    return [];
  }

  const deltas = await query<DateSum>(
    `SELECT posted_on AS date, COALESCE(SUM(amount), 0)::bigint AS cents
     FROM (
       SELECT posted_on, amount_cents AS amount
       FROM transactions
       WHERE account_id = $1
         AND status = 'Posted'
         AND posted_on <= $2
       UNION ALL
       SELECT posted_on, -amount_cents AS amount
       FROM transactions
       WHERE $3::boolean
         AND matched_account_id = $1
         AND account_id <> $1
         AND status = 'Posted'
         AND posted_on <= $2
     ) effects
     GROUP BY posted_on
     ORDER BY posted_on`,
    [accountId, to, type === "credit_card" || type === "loan"],
  );

  const deltaByDate = new Map(deltas.map((row) => [row.date, Number(row.cents)]));
  let balance = openingBalanceCents;

  for (const [date, cents] of deltaByDate) {
    if (date > openingOn && date < from) {
      balance += cents;
    }
  }

  const series: DatedCents[] = [];
  const firstDay = from > openingOn ? from : openingOn;

  if (firstDay === openingOn && firstDay <= to) {
    series.push({ date: openingOn, cents: openingBalanceCents });
  }

  const walkStart = from > addDays(openingOn, 1) ? from : addDays(openingOn, 1);

  for (const day of eachDate(walkStart, to)) {
    balance += deltaByDate.get(day) ?? 0;
    series.push({ date: day, cents: balance });
  }

  return series;
}

export async function incomeExpenseByMonth(
  from: string,
  to: string,
): Promise<MonthTotals[]> {
  const rows = await query<MonthSum>(
    `SELECT to_char(t.posted_on, 'YYYY-MM') AS month,
            COALESCE(SUM(t.amount_cents) FILTER (WHERE a.type = 'income'), 0)::bigint AS "incomeCents",
            COALESCE(SUM(-t.amount_cents) FILTER (WHERE a.type IN ('bill', 'household', 'other')), 0)::bigint AS "expenseCents"
     FROM transactions t
     JOIN accounts a ON a.id = t.matched_account_id
     WHERE t.status = 'Posted'
       AND t.posted_on BETWEEN $1 AND $2
     GROUP BY 1
     ORDER BY 1`,
    [from, to],
  );

  const byMonth = new Map(
    rows.map((row) => [
      row.month,
      {
        incomeCents: Number(row.incomeCents),
        expenseCents: Number(row.expenseCents),
      },
    ]),
  );

  const months: MonthTotals[] = [];
  let cursor = from.slice(0, 7);
  const last = to.slice(0, 7);

  while (cursor <= last) {
    const totals = byMonth.get(cursor) ?? { incomeCents: 0, expenseCents: 0 };
    months.push({ month: cursor, ...totals });
    cursor = nextMonth(cursor);

    if (months.length > 240) {
      break;
    }
  }

  return months;
}

function nextMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
