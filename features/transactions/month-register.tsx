import Link from "next/link";
import { connection } from "next/server";
import { MonthSummary } from "@/features/transactions/month-summary";
import { DatabaseError, logDatabaseError } from "@/app/ui";
import { getAccount } from "@/lib/accounts";
import { parseMonth } from "@/lib/dates";
import { parseId } from "@/lib/ids";
import { formatCents } from "@/lib/money";
import { adjacentMonths, getRegister } from "@/lib/register";
import { accountMonthlyTotals } from "@/lib/reports";

export async function MonthRegister({
  searchParams,
  path,
}: {
  searchParams: Promise<{ month?: string; account?: string }>;
  path: string;
}) {
  await connection();
  const query = await searchParams;
  const today = new Date();
  const month = parseMonth(query.month, today);
  const selectedId = parseId(query.account);
  const { previous, next } = adjacentMonths(month);

  try {
    const [data, account, points] = await Promise.all([
      getRegister(month, today),
      selectedId === null ? Promise.resolve(null) : getAccount(selectedId),
      selectedId === null ? Promise.resolve([]) : accountMonthlyTotals(selectedId, month),
    ]);
    const estimated =
      data.estimatedCount === 1 ? "1 estimated" : `${data.estimatedCount} estimated`;
    const transactions =
      data.transactionCount === 1 ? "1 transaction" : `${data.transactionCount} transactions`;
    const accountChart = account
      ? { name: account.name, points, clearHref: registerHref(path, month, null) }
      : null;

    return (
      <div className="register">
        <div>
          <div className="month-bar">
            <Link href={registerHref(path, previous, selectedId)} aria-label="Previous month">
              ‹
            </Link>
            <h1>{data.label}</h1>
            <Link href={registerHref(path, next, selectedId)} aria-label="Next month">
              ›
            </Link>
          </div>
          <p className="summary">
            {transactions}
            {data.estimatedCount > 0 ? `, ${estimated}` : ""}
          </p>
          {data.rows.length === 0 ? (
            <p className="muted">No transactions this month.</p>
          ) : (
            <div className="table-wrap">
              <table className="register-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Account</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th className="num">Amount</th>
                    <th className="num">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.id} className={row.estimated ? "estimated" : undefined}>
                      <td className="nowrap">{row.date}</td>
                      <td>
                        {row.accountId !== null && row.account ? (
                          <Link
                            className="account-link"
                            href={registerHref(path, month, row.accountId)}
                            aria-current={row.accountId === account?.id ? "true" : undefined}
                          >
                            {row.account}
                          </Link>
                        ) : (
                          row.account
                        )}
                      </td>
                      <td>
                        <Link className="row-link" href={row.href}>
                          {row.description}
                        </Link>
                      </td>
                      <td>{row.type}</td>
                      <td className={amountClass(row.amountCents)}>{formatCents(row.amountCents)}</td>
                      <td className={balanceClass(row.balanceCents)}>{formatCents(row.balanceCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <MonthSummary
          liabilities={data.liabilities}
          incomeCents={data.incomeCents}
          expenses={data.expenses}
          accountChart={accountChart}
        />
      </div>
    );
  } catch (error) {
    logDatabaseError(error);
    return <DatabaseError />;
  }
}

function registerHref(path: string, month: string, accountId: number | null): string {
  const params = new URLSearchParams({ month });
  if (accountId !== null) {
    params.set("account", String(accountId));
  }
  return `${path}?${params.toString()}`;
}

function amountClass(cents: number): string {
  if (cents > 0) return "num positive";
  if (cents < 0) return "num negative";
  return "num";
}

function balanceClass(cents: number): string {
  return cents < 0 ? "num negative" : "num";
}
