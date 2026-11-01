// Expected-but-not-yet-seen scheduled items for a month.
import { isScheduleType } from "./accountTypes.js";
import { addDays, monthBounds } from "./dates.js";

/** A deposit this many days from a payday counts as that payday. Half of 14, so windows do not overlap. */
const PAYCHECK_WINDOW_DAYS = 6;

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
function daysBetween(from, to) {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}

/** Dates `anchor + 14k` that fall inside [start, end], inclusive. */
function biweeklyDates(anchor, start, end) {
  if (!anchor || start > end) return [];
  let cursor = anchor;
  if (cursor > start) {
    const steps = Math.floor(daysBetween(start, cursor) / 14);
    cursor = addDays(cursor, -steps * 14);
  }
  while (cursor < start) cursor = addDays(cursor, 14);
  const dates = [];
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 14);
  }
  return dates;
}

function postedTouching(transactions, name) {
  return transactions.filter(
    (tx) => tx.status === "Posted" && (tx.account === name || tx.matched_account === name),
  );
}

/**
 * Paydays already covered by a positive deposit. Each deposit claims the nearest
 * occurrence within PAYCHECK_WINDOW_DAYS; the window may sit outside `month`.
 */
function claimedPaydays(anchor, month, deposits) {
  const { start, end } = monthBounds(month);
  const occurrences = biweeklyDates(anchor, addDays(start, -PAYCHECK_WINDOW_DAYS), addDays(end, PAYCHECK_WINDOW_DAYS));
  const claimed = new Set();
  for (const tx of deposits) {
    let best = null;
    let bestDist = PAYCHECK_WINDOW_DAYS + 1;
    for (const date of occurrences) {
      if (claimed.has(date)) continue;
      const dist = Math.abs(daysBetween(date, tx.posted_on));
      if (dist < bestDist) {
        best = date;
        bestDist = dist;
      }
    }
    if (best !== null) claimed.add(best);
  }
  return claimed;
}

/** Unsatisfied occurrence dates for one scheduled account in `month`. */
function openDates(account, transactions, month) {
  const cadence = account.cadence || "day";
  const { start, end, lastDay } = monthBounds(month);
  const touching = postedTouching(transactions, account.name);
  // A paycheck is money in. Deductions matched to an income account do not clear it.
  const deposits = account.type === "income" ? touching.filter((tx) => tx.amount_cents > 0) : touching;

  if (cadence === "biweekly") {
    if (!account.anchor_on) return [];
    const claimed = claimedPaydays(account.anchor_on, month, deposits);
    return biweeklyDates(account.anchor_on, start, end).filter((date) => !claimed.has(date));
  }

  const paid = deposits.some((tx) => tx.posted_on >= start && tx.posted_on <= end);
  if (paid) return [];

  if (cadence === "month") return [end];

  if (account.due_day == null) return [];
  const day = Math.min(account.due_day, lastDay);
  return [`${month}-${String(day).padStart(2, "0")}`];
}

/**
 * Scheduled accounts with no Posted activity covering them yet.
 * Income comes in; everything else goes out. Biweekly accounts can appear more than once.
 * Once-a-month income with no fixed day is dated the last day of the month.
 */
export function listUpcoming(accounts, transactions, month, todayIso) {
  return accounts
    .filter(
      (a) => !a.archived && a.schedule_active && a.expected_amount_cents !== null && isScheduleType(a.type),
    )
    .flatMap((a) =>
      openDates(a, transactions, month).map((dueOn) => ({
        name: a.name,
        type: a.type,
        dueOn,
        amountCents: a.expected_amount_cents,
        pastDue: dueOn < todayIso,
        direction: a.type === "income" ? "in" : "out",
      })),
    )
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.name.localeCompare(b.name));
}
