import Link from "next/link";
import { connection } from "next/server";
import { DataGrid } from "@/features/grid/data-grid";
import { MonthSummary } from "@/features/transactions/month-summary";
import { parseMonth } from "@/lib/dates";
import { adjacentMonths, getRegister } from "@/lib/register";
import { DatabaseError, logDatabaseError } from "@/app/ui";

const COLUMNS = [
  { field: "sortKey", header: "Order", hide: true, sort: "asc" as const },
  { field: "date", header: "Date", width: 130 },
  { field: "account", header: "Account", flex: 1, minWidth: 120 },
  { field: "description", header: "Description", flex: 1.4, minWidth: 160 },
  { field: "type", header: "Type", width: 130 },
  { field: "amountCents", header: "Amount", kind: "moneySigned" as const, width: 120 },
  { field: "balanceCents", header: "Balance", kind: "money" as const, width: 130 },
];

export async function MonthRegister({
  searchParams,
  path,
}: {
  searchParams: Promise<{ month?: string }>;
  path: string;
}) {
  await connection();
  const query = await searchParams;
  const today = new Date();
  const month = parseMonth(query.month, today);
  const { previous, next } = adjacentMonths(month);

  try {
    const data = await getRegister(month, today);
    const estimated =
      data.estimatedCount === 1 ? "1 estimated" : `${data.estimatedCount} estimated`;
    const transactions =
      data.transactionCount === 1 ? "1 transaction" : `${data.transactionCount} transactions`;

    return (
      <div className="register">
        <div>
          <div className="month-bar">
            <Link href={`${path}?month=${previous}`} aria-label="Previous month">
              ‹
            </Link>
            <h1>{data.label}</h1>
            <Link href={`${path}?month=${next}`} aria-label="Next month">
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
            <DataGrid rows={data.rows} columns={COLUMNS} />
          )}
        </div>
        <MonthSummary
          owedCents={data.owedCents}
          liabilities={data.liabilities}
          incomeCents={data.incomeCents}
          expenses={data.expenses}
        />
      </div>
    );
  } catch (error) {
    logDatabaseError(error);
    return <DatabaseError />;
  }
}
