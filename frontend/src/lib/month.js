// Home page model: one month, grouped by account type, plus cash projection and transfer cues.
import { SECTIONS } from "./accountTypes.js";
import { balanceOf, totalChecking } from "./balances.js";
import { monthBounds } from "./dates.js";
import { listUpcoming } from "./upcoming.js";

const TRANSFER_NAME = /transfer|loan/i;

/**
 * Walk expected events forward from today's cash. Outflows are applied before inflows on the same
 * day (conservative: a bill and a paycheck on one date is treated as the bill clearing first).
 * Unpaid items already past due are assumed to clear today.
 */
export function projectCash(cashNow, upcoming, todayIso) {
  const events = upcoming
    .map((u) => ({
      date: u.dueOn < todayIso ? todayIso : u.dueOn,
      dueOn: u.dueOn,
      name: u.name,
      type: u.type,
      pastDue: u.pastDue,
      delta: u.direction === "in" ? u.amountCents : -u.amountCents,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.delta - b.delta || a.name.localeCompare(b.name));

  let balance = cashNow;
  const timeline = events.map((event) => {
    balance += event.delta;
    return { ...event, balance };
  });

  let low = { date: todayIso, balanceCents: cashNow, name: null };
  for (const row of timeline) {
    if (row.balance < low.balanceCents) low = { date: row.date, balanceCents: row.balance, name: row.name };
  }

  return { timeline, low, endCents: balance };
}

/**
 * Smallest set of "move $X from the loan to checking by DATE" transfers that keeps checking
 * at or above `buffer`, each as late as possible (less interest, no overdraft).
 */
export function planTransfers(cashNow, timeline, todayIso, buffer = 0) {
  const tranches = [];
  let balance = cashNow;

  const add = (date, amount, because) => {
    const existing = tranches.find((t) => t.date === date);
    if (existing) {
      existing.amountCents += amount;
      existing.because.push(because);
    } else {
      tranches.push({ date, amountCents: amount, because: [because] });
    }
    balance += amount;
  };

  if (balance < buffer) add(todayIso, buffer - balance, "checking is below the buffer today");
  for (const row of timeline) {
    balance += row.delta;
    if (balance < buffer) add(row.date, buffer - balance, row.name);
  }

  return tranches;
}

function accountMap(accounts) {
  return new Map(accounts.map((a) => [a.name, a]));
}

/** Posted transactions in the month that look like loan <-> checking movement. */
export function loanTransfers(accounts, monthTxs) {
  const byName = accountMap(accounts);
  return monthTxs
    .filter((tx) => {
      const matched = tx.matched_account ? byName.get(tx.matched_account) : null;
      const source = byName.get(tx.account);
      return (
        matched?.type === "loan" ||
        source?.type === "loan" ||
        (matched && TRANSFER_NAME.test(matched.name)) ||
        TRANSFER_NAME.test(tx.description)
      );
    })
    .map((tx) => ({
      hash: tx.hash,
      date: tx.posted_on,
      description: tx.description,
      counterparty: tx.matched_account ?? "",
      amountCents: tx.amount_cents,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildMonth(accounts, transactions, month, todayIso, { bufferCents = 0 } = {}) {
  const { start, end } = monthBounds(month);
  const byName = accountMap(accounts);
  const monthTxs = transactions.filter((tx) => tx.status === "Posted" && tx.posted_on >= start && tx.posted_on <= end);
  const upcoming = listUpcoming(accounts, transactions, month, todayIso);

  // --- sections ------------------------------------------------------------
  const sections = new Map(SECTIONS.map((s) => [s.type, { ...s, items: new Map(), postedCents: 0, expectedCents: 0 }]));
  const unmatched = { inCents: 0, outCents: 0, count: 0 };

  const itemFor = (section, name) => {
    let item = section.items.get(name);
    if (!item) {
      item = { name, postedCents: 0, expectedCents: 0, count: 0 };
      section.items.set(name, item);
    }
    return item;
  };

  for (const tx of monthTxs) {
    const matched = tx.matched_account ? byName.get(tx.matched_account) : null;
    if (!matched) {
      unmatched.count++;
      if (tx.amount_cents >= 0) unmatched.inCents += tx.amount_cents;
      else unmatched.outCents += -tx.amount_cents;
      continue;
    }
    const section = sections.get(matched.type) ?? sections.get("other");
    const cents = matched.type === "income" ? tx.amount_cents : -tx.amount_cents;
    const item = itemFor(section, matched.name);
    item.postedCents += cents;
    item.count++;
    section.postedCents += cents;
  }

  for (const u of upcoming) {
    const section = sections.get(u.type) ?? sections.get("other");
    const item = itemFor(section, u.name);
    item.expectedCents += u.amountCents;
    section.expectedCents += u.amountCents;
  }

  const sectionList = [...sections.values()].map((s) => ({
    type: s.type,
    label: s.label,
    postedCents: s.postedCents,
    expectedCents: s.expectedCents,
    totalCents: s.postedCents + s.expectedCents,
    items: [...s.items.values()]
      .map((i) => ({ ...i, totalCents: i.postedCents + i.expectedCents }))
      .sort((a, b) => Math.abs(b.totalCents) - Math.abs(a.totalCents) || a.name.localeCompare(b.name)),
  }));

  // --- gap -----------------------------------------------------------------
  const income = sectionList.find((s) => s.type === "income");
  const outflowSections = sectionList.filter((s) => s.type !== "income");
  const outflowPosted = outflowSections.reduce((n, s) => n + s.postedCents, 0) + unmatched.outCents;
  const outflowExpected = outflowSections.reduce((n, s) => n + s.expectedCents, 0);
  const incomePosted = income.postedCents + unmatched.inCents;
  const incomeExpected = income.expectedCents;
  const gap = {
    incomeCents: incomePosted + incomeExpected,
    outflowCents: outflowPosted + outflowExpected,
    gapCents: incomePosted + incomeExpected - outflowPosted - outflowExpected,
    incomePostedCents: incomePosted,
    incomeExpectedCents: incomeExpected,
    outflowPostedCents: outflowPosted,
    outflowExpectedCents: outflowExpected,
  };

  // --- cash projection -------------------------------------------------------
  const cashNow = totalChecking(accounts, transactions);
  const projection = projectCash(cashNow, upcoming, todayIso);
  const transfers = planTransfers(cashNow, projection.timeline, todayIso, bufferCents);

  // --- tracked balances ------------------------------------------------------
  const upcomingDelta = (name) =>
    upcoming.filter((u) => u.name === name).reduce((n, u) => n + (u.direction === "in" ? -u.amountCents : u.amountCents), 0);

  const tracked = (type) =>
    accounts
      .filter((a) => a.type === type && !a.archived)
      .map((a) => ({ name: a.name, balanceCents: balanceOf(a, transactions) }))
      .filter((a) => a.balanceCents !== null)
      .map((a) => ({
        ...a,
        // Liability balances are negative (owed); an expected payment moves them toward 0.
        endOfMonthCents: type === "checking" ? projection.endCents : a.balanceCents + upcomingDelta(a.name),
      }));

  const checking = accounts
    .filter((a) => a.type === "checking" && !a.archived)
    .map((a) => ({ name: a.name, balanceCents: balanceOf(a, transactions) }))
    .filter((a) => a.balanceCents !== null);

  return {
    month,
    sections: sectionList,
    unmatched,
    gap,
    upcoming,
    cashNowCents: cashNow,
    timeline: projection.timeline,
    low: projection.low,
    endCents: projection.endCents,
    goesNegative: projection.low.balanceCents < 0,
    transfers,
    loanTransfers: loanTransfers(accounts, monthTxs),
    balances: {
      checking,
      loans: tracked("loan"),
      cards: tracked("credit_card"),
    },
    txCount: monthTxs.length,
  };
}
