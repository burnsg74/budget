// Multi-month reports (old lib/reports.ts) plus the job-search income floor.
import { isBalanceType, isOverdraftAccount, isSpendingType } from "./accountTypes.js";
import { balanceOf } from "./balances.js";
import { monthBounds, monthOf, monthRange, shiftMonth, toIsoDate } from "./dates.js";

export function defaultRange(todayIso) {
  const [y, m] = todayIso.split("-").map(Number);
  return { from: toIsoDate(new Date(y, m - 12, 1)), to: todayIso };
}

/**
 * Income vs expenses per month, inclusive of empty months.
 * income   = matched to income accounts
 * expenses = matched to bill / household / other (old definition)
 * debt     = payments matched to credit_card / loan (shown separately, never in expenses)
 * Checking-loan draws and repayments are omitted from all three.
 */
export function incomeExpenseByMonth(accounts, transactions, from, to) {
  const byName = new Map(accounts.map((a) => [a.name, a]));
  const rows = new Map(monthRange(monthOf(from), monthOf(to)).map((m) => [m, { month: m, incomeCents: 0, expenseCents: 0, debtCents: 0 }]));

  for (const tx of transactions) {
    if (tx.status !== "Posted" || tx.posted_on < from || tx.posted_on > to) continue;
    const row = rows.get(monthOf(tx.posted_on));
    const matched = tx.matched_account ? byName.get(tx.matched_account) : null;
    if (!row || !matched || isOverdraftAccount(matched)) continue;
    const type = matched.type;
    if (type === "income") row.incomeCents += tx.amount_cents;
    else if (isSpendingType(type)) row.expenseCents += -tx.amount_cents;
    else if (type === "credit_card" || type === "loan") row.debtCents += -tx.amount_cents;
  }

  return [...rows.values()].map((r) => ({ ...r, netCents: r.incomeCents - r.expenseCents - r.debtCents }));
}

/**
 * End-of-month balance for each loan and credit card. null before the account's opening month.
 * The last month is "as of" today when it is the current month.
 */
export function liabilityBalancesByMonth(accounts, transactions, from, to) {
  const months = monthRange(monthOf(from), monthOf(to));
  const liabilities = accounts.filter((a) => (a.type === "loan" || a.type === "credit_card") && !a.archived);

  return {
    months,
    accounts: liabilities.map((a) => ({
      name: a.name,
      type: a.type,
      points: months.map((m) => {
        const end = monthBounds(m).end;
        if (!a.opening_on || end < a.opening_on) return { month: m, cents: null };
        return { month: m, cents: balanceOf(a, transactions, end) };
      }),
    })),
  };
}

/** Daily spending for one account in a range (checking: outflows not matched to cards/loans). */
export function spendingSeries(accounts, transactions, accountName, from, to) {
  const account = accounts.find((a) => a.name === accountName);
  if (!account) return [];
  const byName = new Map(accounts.map((a) => [a.name, a]));
  const byDate = new Map();

  for (const tx of transactions) {
    if (tx.status !== "Posted" || tx.posted_on < from || tx.posted_on > to) continue;
    let cents = 0;
    if (account.type === "checking") {
      const matched = tx.matched_account ? byName.get(tx.matched_account) : null;
      const matchedType = matched?.type;
      if (
        tx.account === account.name &&
        tx.amount_cents < 0 &&
        matchedType !== "credit_card" &&
        matchedType !== "loan" &&
        !isOverdraftAccount(matched)
      ) {
        cents = -tx.amount_cents;
      }
    } else if (isSpendingType(account.type) && tx.matched_account === account.name) {
      cents = -tx.amount_cents;
    }
    if (cents !== 0) byDate.set(tx.posted_on, (byDate.get(tx.posted_on) ?? 0) + cents);
  }

  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, cents]) => ({ date, cents }));
}

/** Sum of |amount| matched to the account for each of the last `count` months ending `endMonth`. */
export function monthlyTotals(transactions, accountName, endMonth, count = 12) {
  const first = shiftMonth(endMonth, -(count - 1));
  const rows = new Map(monthRange(first, endMonth).map((m) => [m, 0]));
  for (const tx of transactions) {
    if (tx.status !== "Posted" || (tx.matched_account !== accountName && tx.account !== accountName)) continue;
    const m = monthOf(tx.posted_on);
    if (rows.has(m)) rows.set(m, rows.get(m) + Math.abs(tx.amount_cents));
  }
  return [...rows.entries()].map(([month, cents]) => ({ month, cents }));
}

/** Series the account detail graph should show. */
export function detailGraphKind(account) {
  return isBalanceType(account.type) && account.opening_on ? "balance" : "monthly";
}

/** Monthly figure for an expected amount. Biweekly paychecks average out to 26/12 per month. */
export function monthlyEquivalentCents(account) {
  const amount = account.expected_amount_cents ?? 0;
  if (account.type === "income" && (account.cadence || "day") === "biweekly") return Math.round((amount * 26) / 12);
  return amount;
}

/**
 * Minimum income to cover bills without the other earners.
 *   required  = expected bills + required debt payments (active, scheduled, expected amount set)
 *   mine      = expected income from the chosen income accounts (biweekly as a monthly average)
 *   floorCents = required (what the job must at least pay); shortfall = max(0, required - mine)
 */
export function jobSearchFloor(accounts, myIncomeNames, { extraSpendingCents = 0 } = {}) {
  const active = accounts.filter((a) => !a.archived && a.schedule_active && a.expected_amount_cents !== null);
  const sum = (list) => list.reduce((n, a) => n + monthlyEquivalentCents(a), 0);
  const mineSet = new Set(myIncomeNames);

  const bills = active.filter((a) => a.type === "bill");
  const debt = active.filter((a) => a.type === "credit_card" || a.type === "loan");
  const income = active.filter((a) => a.type === "income" && !isOverdraftAccount(a));
  const mine = income.filter((a) => mineSet.has(a.name));
  const others = income.filter((a) => !mineSet.has(a.name));

  const billsCents = sum(bills);
  const debtCents = sum(debt);
  const requiredCents = billsCents + debtCents + extraSpendingCents;
  const mineCents = sum(mine);

  return {
    bills,
    debt,
    mine,
    others,
    billsCents,
    debtCents,
    extraSpendingCents,
    requiredCents,
    mineCents,
    othersCents: sum(others),
    floorCents: requiredCents,
    shortfallCents: Math.max(0, requiredCents - mineCents),
    surplusCents: Math.max(0, mineCents - requiredCents),
  };
}

/** Average monthly spending on household + other over the last `months` complete months. */
export function typicalSpending(accounts, transactions, todayIso, months = 3) {
  const byName = new Map(accounts.map((a) => [a.name, a]));
  const end = monthBounds(shiftMonth(monthOf(todayIso), -1)).end;
  const start = `${shiftMonth(monthOf(todayIso), -months)}-01`;
  let total = 0;
  for (const tx of transactions) {
    if (tx.status !== "Posted" || tx.posted_on < start || tx.posted_on > end || !tx.matched_account) continue;
    const matched = byName.get(tx.matched_account);
    if (!matched || isOverdraftAccount(matched)) continue;
    if (matched.type === "household" || matched.type === "other") total += -tx.amount_cents;
  }
  return Math.round(total / months);
}
