// Expected-but-not-yet-seen scheduled items for a month.
import { isScheduleType } from "./accountTypes.js";
import { monthBounds } from "./dates.js";

/** Names of accounts that appear (as account or matched_account) in Posted txns within the month. */
export function paidNames(transactions, month) {
  const { start, end } = monthBounds(month);
  const paid = new Set();
  for (const tx of transactions) {
    if (tx.status !== "Posted" || tx.posted_on < start || tx.posted_on > end) continue;
    paid.add(tx.account);
    if (tx.matched_account) paid.add(tx.matched_account);
  }
  return paid;
}

/**
 * Scheduled accounts with no Posted activity this month, dated on their due day
 * (clamped to the month length). Income comes in; everything else goes out.
 */
export function listUpcoming(accounts, transactions, month, todayIso) {
  const { lastDay } = monthBounds(month);
  const paid = paidNames(transactions, month);

  return accounts
    .filter(
      (a) =>
        !a.archived &&
        a.schedule_active &&
        a.expected_amount_cents !== null &&
        a.due_day !== null &&
        !paid.has(a.name) &&
        isScheduleType(a.type),
    )
    .map((a) => {
      const day = Math.min(a.due_day, lastDay);
      const dueOn = `${month}-${String(day).padStart(2, "0")}`;
      return {
        name: a.name,
        type: a.type,
        dueOn,
        amountCents: a.expected_amount_cents,
        pastDue: dueOn < todayIso,
        direction: a.type === "income" ? "in" : "out",
      };
    })
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.name.localeCompare(b.name));
}
