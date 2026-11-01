// Derived balances:
//   checking / credit_card / loan only, and only when opening_on is set.
//   balance = opening_balance_cents
//           + SUM(amount) of Posted txns where account = this AND posted_on > opening_on
//           + (credit_card / loan) SUM(-amount) of Posted txns where matched_account = this
//             AND account != this AND posted_on > opening_on
import { isBalanceType, isLiabilityType } from "./accountTypes.js";
import { addDays, eachDate } from "./dates.js";

const POSTED = "Posted";

/**
 * Signed effect of one transaction on one account's balance (0 when it does not apply).
 */
export function effectOn(account, tx) {
  if (tx.status !== POSTED) return 0;
  if (tx.account === account.name) return tx.amount_cents;
  if (isLiabilityType(account.type) && tx.matched_account === account.name) return -tx.amount_cents;
  return 0;
}

/** Balance as of end of `asOf` (inclusive; default: everything). null when not tracked. */
export function balanceOf(account, transactions, asOf = null) {
  if (!isBalanceType(account.type) || !account.opening_on) return null;
  let balance = account.opening_balance_cents;
  for (const tx of transactions) {
    if (tx.posted_on <= account.opening_on) continue;
    if (asOf && tx.posted_on > asOf) continue;
    balance += effectOn(account, tx);
  }
  return balance;
}

/** Map of account name -> balance (only tracked accounts). */
export function balancesByName(accounts, transactions) {
  const out = new Map();
  for (const account of accounts) {
    const balance = balanceOf(account, transactions);
    if (balance !== null) out.set(account.name, balance);
  }
  return out;
}

/**
 * Daily balance series from max(from, opening_on) to `to`.
 * Includes the opening point itself when `from` is on/before opening_on.
 */
export function balanceSeries(account, transactions, from, to) {
  if (!isBalanceType(account.type) || !account.opening_on) return [];

  const deltaByDate = new Map();
  for (const tx of transactions) {
    if (tx.posted_on <= account.opening_on || tx.posted_on > to) continue;
    const effect = effectOn(account, tx);
    if (effect !== 0) deltaByDate.set(tx.posted_on, (deltaByDate.get(tx.posted_on) ?? 0) + effect);
  }

  let balance = account.opening_balance_cents;
  for (const [date, cents] of deltaByDate) {
    if (date < from) balance += cents;
  }

  const series = [];
  if (from <= account.opening_on && account.opening_on <= to) {
    series.push({ date: account.opening_on, cents: account.opening_balance_cents });
  }

  const dayAfterOpening = addDays(account.opening_on, 1);
  const walkStart = from > dayAfterOpening ? from : dayAfterOpening;
  for (const day of eachDate(walkStart, to)) {
    balance += deltaByDate.get(day) ?? 0;
    series.push({ date: day, cents: balance });
  }
  return series;
}

/** Total of checking balances (active accounts with a tracked balance). */
export function totalChecking(accounts, transactions) {
  let total = 0;
  for (const account of accounts) {
    if (account.type !== "checking" || account.archived) continue;
    total += balanceOf(account, transactions) ?? 0;
  }
  return total;
}
