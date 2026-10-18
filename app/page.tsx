import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { TYPE_LABELS, isLiabilityType } from "@/lib/account-types";
import { getDashboard, type CashItem } from "@/lib/dashboard";
import { formatDate } from "@/lib/dates";
import { formatCents, formatHeldBalance } from "@/lib/money";
import { DatabaseError, PageIntro, logDatabaseError } from "./ui";

export default function Home() {
  return (
    <main className="page">
      <Suspense fallback={<PageIntro title="This month" lede="Loading the month…" />}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  await connection();

  try {
    const today = new Date();
    const data = await getDashboard(today);

    if (!data.hasAccounts) {
      return (
        <>
          <PageIntro title={data.monthLabel} lede="Nothing is tracked yet." />
          <p className="muted">
            Create a checking account, then add bills named after the bank text you want to
            match, such as Netflix or PennyMac.
          </p>
          <p>
            <Link className="button" href="/accounts/new">
              New account
            </Link>
          </p>
        </>
      );
    }

    return (
      <>
        <PageIntro
          title={data.monthLabel}
          lede="Cash, what is owed, and what is still expected this month."
          action={
            <Link className="button secondary" href="/import">
              Import
            </Link>
          }
        />
        <section className="stats">
          <article className="stat">
            <span>Cash</span>
            <strong>{formatCents(data.cashCents)}</strong>
          </article>
          <article className="stat">
            <span>Owed</span>
            <strong>{formatCents(data.owedCents)}</strong>
          </article>
          <article className="stat">
            <span>Income</span>
            <strong>{formatCents(data.incomeCents)}</strong>
          </article>
          <article className="stat">
            <span>Spending</span>
            <strong>{formatCents(data.spendingCents)}</strong>
          </article>
          <article className="stat">
            <span>Projected cash</span>
            <strong>{formatCents(data.projectedCents)}</strong>
          </article>
        </section>
        <p className="help">
          Projected cash is the checking total, plus income still expected, minus unpaid
          bills and card or loan payments.
        </p>
        {data.unlinkedCents > 0 ? (
          <p className="help">
            {formatCents(data.unlinkedCents)} left checking without a linked account, so it is
            not in spending yet.
          </p>
        ) : null}

        <BalanceGroup title="Checking" items={data.checking} />
        <BalanceGroup title="Credit cards" items={data.cards} />
        <BalanceGroup title="Loans" items={data.loans} />

        <section className="section">
          <h2>Still to come</h2>
          {data.upcoming.length === 0 ? (
            <p className="muted">
              {data.hasTransactions
                ? "No unpaid monthly amounts left this month."
                : "Import transactions, then turn on monthly tracking for bills you want projected."}
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Account</th>
                    <th>Type</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.upcoming.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {formatDate(item.dueOn)}
                        {item.pastDue ? <span className="sub">Past due</span> : null}
                      </td>
                      <td>
                        <Link href={`/accounts/${item.id}`}>{item.name}</Link>
                      </td>
                      <td>{TYPE_LABELS[item.type]}</td>
                      <td className={item.direction === "in" ? "num positive" : "num"}>
                        {item.direction === "in" ? "+" : "−"}
                        {formatCents(item.amountCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </>
    );
  } catch (error) {
    logDatabaseError(error);
    return (
      <>
        <PageIntro title="This month" />
        <DatabaseError />
      </>
    );
  }
}

function BalanceGroup({ title, items }: { title: string; items: CashItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="section">
      <h2>{title}</h2>
      <ul className="account-list">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/accounts/${item.id}`}>
              <span>{item.name}</span>
              <span className="money">
                {formatHeldBalance(item.balanceCents, isLiabilityType(item.type))}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
