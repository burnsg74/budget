import assert from "node:assert/strict";
import { test } from "node:test";
import { balanceOf, balanceSeries, totalChecking } from "./balances.js";
import { buildMonth, planTransfers, projectCash } from "./month.js";
import { incomeExpenseByMonth, jobSearchFloor, liabilityBalancesByMonth, monthlyEquivalentCents } from "./reports.js";
import { listUpcoming } from "./upcoming.js";
import { centsToInput, dollarsToCents } from "./money.js";

const acct = (over) => ({
  name: "x",
  match_text: "x",
  type: "other",
  institution: null,
  mask: null,
  opening_balance_cents: 0,
  opening_on: null,
  expected_amount_cents: null,
  due_day: null,
  cadence: "day",
  anchor_on: null,
  schedule_active: false,
  archived: false,
  created_at: "",
  ...over,
});

const tx = (over) => ({
  hash: Math.random().toString(36),
  account: "Checking",
  matched_account: null,
  posted_on: "2026-10-05",
  description: "d",
  amount_cents: 0,
  check_number: null,
  status: "Posted",
  classification: null,
  created_at: "",
  ...over,
});

const accounts = [
  acct({ name: "Checking", type: "checking", opening_balance_cents: 100000, opening_on: "2026-09-30" }),
  acct({ name: "Card", type: "credit_card", opening_balance_cents: -50000, opening_on: "2026-09-30", expected_amount_cents: 20000, due_day: 20, schedule_active: true }),
  acct({ name: "Loan", type: "loan", opening_balance_cents: -1000000, opening_on: "2026-09-30", expected_amount_cents: 30000, due_day: 8, schedule_active: true }),
  acct({ name: "Pay", type: "income", expected_amount_cents: 150000, due_day: 15, schedule_active: true }),
  acct({ name: "Rent", type: "bill", expected_amount_cents: 80000, due_day: 1, schedule_active: true }),
  acct({ name: "Phone", type: "bill", expected_amount_cents: 10000, due_day: 25, schedule_active: true }),
  acct({ name: "Food", type: "household" }),
];

const txs = [
  tx({ posted_on: "2026-09-15", amount_cents: -99999, matched_account: "Food" }), // before opening_on: ignored
  tx({ posted_on: "2026-10-01", amount_cents: -80000, matched_account: "Rent" }),
  tx({ posted_on: "2026-10-03", amount_cents: -4000, matched_account: "Food" }),
  tx({ posted_on: "2026-10-04", amount_cents: -30000, matched_account: "Loan" }), // payment toward loan
  tx({ posted_on: "2026-10-05", amount_cents: -10000, matched_account: "Card" }),
  tx({ posted_on: "2026-10-06", amount_cents: 5000, matched_account: "Pay", status: "Pending" }), // ignored
];

test("checking balance: opening + posted txns after opening_on", () => {
  assert.equal(balanceOf(accounts[0], txs), 100000 - 80000 - 4000 - 30000 - 10000);
});

test("liability balance: payments matched to it reduce what is owed", () => {
  assert.equal(balanceOf(accounts[1], txs), -50000 + 10000);
  assert.equal(balanceOf(accounts[2], txs), -1000000 + 30000);
});

test("no balance without opening_on or for non-balance types", () => {
  assert.equal(balanceOf(acct({ type: "checking" }), txs), null);
  assert.equal(balanceOf(accounts[3], txs), null);
});

test("balanceOf asOf respects the cutoff", () => {
  assert.equal(balanceOf(accounts[0], txs, "2026-10-01"), 100000 - 80000);
});

test("balanceSeries ends at the current balance", () => {
  const series = balanceSeries(accounts[0], txs, "2026-09-30", "2026-10-10");
  assert.deepEqual(series[0], { date: "2026-09-30", cents: 100000 });
  assert.equal(series.at(-1).cents, balanceOf(accounts[0], txs, "2026-10-10"));
});

test("upcoming skips paid accounts and clamps due day to the month", () => {
  const feb = listUpcoming([acct({ name: "A", type: "bill", expected_amount_cents: 5, due_day: 31, schedule_active: true })], [], "2026-02", "2026-02-01");
  assert.equal(feb[0].dueOn, "2026-02-28");
  const up = listUpcoming(accounts, txs, "2026-10", "2026-10-10");
  // Rent, Loan, Card were paid this month; Pay and Phone are still expected.
  assert.deepEqual(up.map((u) => u.name), ["Pay", "Phone"]);
  assert.equal(up[0].direction, "in");
});

test("projectCash finds the low point; outflows go first on the same day", () => {
  const upcoming = [
    { name: "Pay", type: "income", dueOn: "2026-10-15", amountCents: 100, pastDue: false, direction: "in" },
    { name: "Bill", type: "bill", dueOn: "2026-10-15", amountCents: 150, pastDue: false, direction: "out" },
  ];
  const { timeline, low, endCents } = projectCash(100, upcoming, "2026-10-10");
  assert.equal(timeline[0].name, "Bill");
  assert.deepEqual(low, { date: "2026-10-15", balanceCents: -50, name: "Bill" });
  assert.equal(endCents, 50);
});

test("past-due items clear today", () => {
  const { timeline } = projectCash(0, [{ name: "B", type: "bill", dueOn: "2026-10-01", amountCents: 10, pastDue: true, direction: "out" }], "2026-10-10");
  assert.equal(timeline[0].date, "2026-10-10");
});

test("planTransfers: just enough, as late as possible", () => {
  const { timeline } = projectCash(
    100,
    [
      { name: "A", type: "bill", dueOn: "2026-10-12", amountCents: 150, pastDue: false, direction: "out" },
      { name: "Pay", type: "income", dueOn: "2026-10-15", amountCents: 500, pastDue: false, direction: "in" },
      { name: "B", type: "bill", dueOn: "2026-10-20", amountCents: 700, pastDue: false, direction: "out" },
    ],
    "2026-10-10",
  );
  const plan = planTransfers(100, timeline, "2026-10-10", 0);
  assert.deepEqual(
    plan.map((p) => [p.date, p.amountCents]),
    [
      ["2026-10-12", 50],
      ["2026-10-20", 200],
    ],
  );
  assert.deepEqual(planTransfers(100, timeline, "2026-10-10", -1000), []);
});

test("buildMonth: sections, gap, balances", () => {
  const m = buildMonth(accounts, txs, "2026-10", "2026-10-10");
  const section = (t) => m.sections.find((s) => s.type === t);
  assert.equal(section("bill").postedCents, 80000);
  assert.equal(section("bill").expectedCents, 10000);
  assert.equal(section("household").postedCents, 4000);
  assert.equal(section("income").expectedCents, 150000);
  assert.equal(m.cashNowCents, totalChecking(accounts, txs));
  assert.equal(m.gap.incomeCents, 150000);
  assert.equal(m.gap.gapCents, 150000 - (80000 + 10000 + 30000 + 10000 + 4000));
  assert.equal(m.balances.loans[0].balanceCents, -970000);
  // Checking is already at -$240 today, so the low point is "now" and a transfer is due today.
  assert.equal(m.cashNowCents, -24000);
  assert.equal(m.goesNegative, true);
  assert.equal(m.transfers[0].date, "2026-10-10");
  assert.equal(m.transfers[0].amountCents, 24000);
});

test("reports: income vs expense and liability balances", () => {
  const rows = incomeExpenseByMonth(accounts, [...txs, tx({ posted_on: "2026-10-15", amount_cents: 150000, matched_account: "Pay" })], "2026-09-01", "2026-10-31");
  assert.equal(rows.length, 2);
  assert.equal(rows[1].incomeCents, 150000);
  assert.equal(rows[1].expenseCents, 84000); // rent + food; card/loan payments are debt
  assert.equal(rows[1].debtCents, 40000);
  const lb = liabilityBalancesByMonth(accounts, txs, "2026-08-01", "2026-10-31");
  const loan = lb.accounts.find((a) => a.name === "Loan");
  assert.deepEqual(loan.points.map((p) => p.cents), [null, -1000000, -970000]);
});

test("job search floor uses only chosen income", () => {
  const f = jobSearchFloor(accounts, ["Pay"]);
  assert.equal(f.billsCents, 90000);
  assert.equal(f.debtCents, 50000);
  assert.equal(f.requiredCents, 140000);
  assert.equal(f.mineCents, 150000);
  assert.equal(f.shortfallCents, 0);
  const none = jobSearchFloor(accounts, []);
  assert.equal(none.shortfallCents, 140000);
});

test("biweekly income lists every paycheck and a deposit clears only the nearest", () => {
  const pay = acct({
    name: "Barrelhead",
    type: "income",
    expected_amount_cents: 100000,
    cadence: "biweekly",
    anchor_on: "2026-10-15",
    schedule_active: true,
  });
  const dates = (month, extra = []) => listUpcoming([pay], extra, month, `${month}-01`).map((u) => u.dueOn);
  assert.deepEqual(dates("2026-10"), ["2026-10-01", "2026-10-15", "2026-10-29"]);
  assert.deepEqual(dates("2026-09"), ["2026-09-03", "2026-09-17"]);

  const deposit = (posted_on) => [tx({ posted_on, amount_cents: 100000, matched_account: "Barrelhead" })];
  assert.deepEqual(dates("2026-10", deposit("2026-10-01")), ["2026-10-15", "2026-10-29"]);
  // Nov 1 is 3 days after Oct 29 and 11 days before Nov 12, so it clears only the October payday.
  assert.deepEqual(dates("2026-10", deposit("2026-11-01")), ["2026-10-01", "2026-10-15"]);
  assert.deepEqual(dates("2026-11", deposit("2026-11-01")), ["2026-11-12", "2026-11-26"]);
  assert.deepEqual(dates("2026-10", deposit("2026-10-21")), ["2026-10-01", "2026-10-29"]);
  assert.deepEqual(dates("2026-10", deposit("2026-10-22")), ["2026-10-01", "2026-10-15", "2026-10-29"]);
  assert.deepEqual(
    dates("2026-10", [tx({ posted_on: "2026-10-15", amount_cents: -500, matched_account: "Barrelhead" })]),
    ["2026-10-01", "2026-10-15", "2026-10-29"],
  );

  const month = buildMonth(
    [acct({ name: "Checking", type: "checking", opening_balance_cents: 0, opening_on: "2026-09-30" }), pay],
    [],
    "2026-10",
    "2026-10-01",
  );
  assert.equal(month.gap.incomeExpectedCents, 300000);
});

test("once a month income sits on the last day until a deposit posts", () => {
  const alex = acct({
    name: "Alex",
    type: "income",
    expected_amount_cents: 50000,
    cadence: "month",
    schedule_active: true,
  });
  const open = listUpcoming([alex], [], "2026-11", "2026-11-02");
  assert.equal(open.length, 1);
  assert.equal(open[0].dueOn, "2026-11-30");
  assert.equal(open[0].direction, "in");
  assert.equal(open[0].pastDue, false);

  const paid = listUpcoming(
    [alex],
    [tx({ posted_on: "2026-11-12", amount_cents: 48000, matched_account: "Alex" })],
    "2026-11",
    "2026-11-13",
  );
  assert.deepEqual(paid, []);

  const deduction = listUpcoming(
    [alex],
    [tx({ posted_on: "2026-11-04", amount_cents: -100, matched_account: "Alex" })],
    "2026-11",
    "2026-11-05",
  );
  assert.equal(deduction[0].dueOn, "2026-11-30");

  const checking = acct({ name: "Checking", type: "checking", opening_balance_cents: 0, opening_on: "2026-10-31" });
  const rent = acct({ name: "Rent", type: "bill", expected_amount_cents: 80000, due_day: 1, schedule_active: true });
  const month = buildMonth([checking, alex, rent], [], "2026-11", "2026-11-01");
  assert.equal(month.upcoming.find((u) => u.name === "Alex").dueOn, "2026-11-30");
  assert.equal(month.gap.incomeExpectedCents, 50000);
  assert.equal(month.transfers[0].date, "2026-11-01");
  assert.equal(month.transfers[0].amountCents, 80000);
});

test("job search floor averages a biweekly paycheck over the year", () => {
  const job = acct({
    name: "Job",
    type: "income",
    expected_amount_cents: 120000,
    cadence: "biweekly",
    anchor_on: "2026-10-15",
    schedule_active: true,
  });
  assert.equal(monthlyEquivalentCents(job), 260000);
  const spouse = acct({
    name: "Spouse",
    type: "income",
    expected_amount_cents: 90000,
    cadence: "month",
    schedule_active: true,
  });
  const f = jobSearchFloor([job, spouse], ["Job"]);
  assert.equal(f.mineCents, 260000);
  assert.equal(f.othersCents, 90000);
});

test("money parsing", () => {
  assert.equal(dollarsToCents("$1,234.5"), 123450);
  assert.equal(dollarsToCents("-0.07"), -7);
  assert.equal(dollarsToCents("abc"), null);
  assert.equal(centsToInput(-1205), "-12.05");
});
