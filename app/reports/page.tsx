import { connection } from "next/server";
import { Suspense } from "react";
import {
  BalanceChart,
  IncomeExpenseChart,
  SpendingChart,
} from "@/features/reports/charts";
import { TYPE_LABELS, isBalanceType } from "@/lib/account-types";
import { listAccounts } from "@/lib/accounts";
import {
  balanceSeries,
  datePoints,
  incomeExpenseByMonth,
  monthPoints,
  resolveRange,
  spendingSeries,
  spendingSeriesApplies,
} from "@/lib/reports";
import { DatabaseError, PageIntro, logDatabaseError } from "../ui";

export default function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; from?: string; to?: string }>;
}) {
  return (
    <main className="page">
      <PageIntro
        title="Reports"
        lede="Spending, balances, and income against expenses."
      />
      <Suspense fallback={<p className="muted">Loading reports…</p>}>
        <Reports searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Reports({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; from?: string; to?: string }>;
}) {
  await connection();
  const query = await searchParams;
  const today = new Date();
  const range = resolveRange(query.from, query.to, today);

  try {
    const accounts = await listAccounts();

    if (accounts.length === 0) {
      return <p className="muted">Create an account before looking at reports.</p>;
    }

    const selected =
      accounts.find((account) => account.id === query.account) ??
      accounts.find((account) => account.type === "checking" && !account.archived) ??
      accounts[0];
    const [spending, balances, months] = await Promise.all([
      spendingSeriesApplies(selected.type)
        ? spendingSeries(selected.id, selected.type, range.from, range.to)
        : Promise.resolve([]),
      isBalanceType(selected.type)
        ? balanceSeries(
            selected.id,
            selected.type,
            selected.openingBalanceCents,
            selected.openingOn,
            range.from,
            range.to,
          )
        : Promise.resolve([]),
      incomeExpenseByMonth(range.from, range.to),
    ]);

    return (
      <>
        <form className="filters" action="/reports">
          <label className="field">
            Account
            <select name="account" defaultValue={selected.id}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {TYPE_LABELS[account.type]}
                  {account.archived ? " (archived)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            From
            <input type="date" name="from" defaultValue={range.from} />
          </label>
          <label className="field">
            To
            <input type="date" name="to" defaultValue={range.to} />
          </label>
          <button className="button secondary" type="submit">
            Update
          </button>
        </form>

        <section className="section">
          <h2>Spending · {selected.name}</h2>
          {spendingSeriesApplies(selected.type) ? (
            <SpendingChart points={datePoints(spending)} />
          ) : (
            <p className="muted">
              The spending line is for checking, bills, household, and other accounts.
            </p>
          )}
        </section>

        <section className="section">
          <h2>Balance history · {selected.name}</h2>
          {isBalanceType(selected.type) ? (
            <BalanceChart
              points={datePoints(balances).map((point) => ({
                ...point,
                cents:
                  selected.type === "credit_card" || selected.type === "loan"
                    ? -point.cents
                    : point.cents,
              }))}
            />
          ) : (
            <p className="muted">
              Balance history is for checking, credit card, and loan accounts.
            </p>
          )}
          {isBalanceType(selected.type) ? (
            <p className="help">
              {selected.type === "checking"
                ? "End of each day, starting from the balance as of date."
                : "Amount owed at the end of each day. Payments linked from checking reduce it."}
            </p>
          ) : null}
        </section>

        <section className="section">
          <h2>Income and expenses</h2>
          <p className="help">
            Income is money linked to an income account. Expenses are money linked to a bill,
            household, or other account. Card and loan payments are left out.
          </p>
          <IncomeExpenseChart points={monthPoints(months)} />
        </section>
      </>
    );
  } catch (error) {
    logDatabaseError(error);
    return <DatabaseError />;
  }
}
