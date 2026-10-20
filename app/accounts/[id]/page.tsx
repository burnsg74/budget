import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DataGrid } from "@/features/grid/data-grid";
import { TYPE_LABELS, isLiabilityType } from "@/lib/account-types";
import { getAccount, listTransactionsForAccount } from "@/lib/accounts";
import { formatDate } from "@/lib/dates";
import { parseId } from "@/lib/ids";
import { formatHeldBalance } from "@/lib/money";
import { DatabaseError, PageIntro, logDatabaseError } from "../../ui";

export default function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ imported?: string }>;
}) {
  return (
    <main className="page">
      <Suspense fallback={<PageIntro title="Account" lede="Loading…" />}>
        <AccountDetail params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function AccountDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ imported?: string }>;
}) {
  await connection();
  const { id: rawId } = await params;
  const query = await searchParams;
  const id = parseId(rawId);

  if (id === null) {
    notFound();
  }

  try {
    const account = await getAccount(id);

    if (!account) {
      notFound();
    }

    const transactions = await listTransactionsForAccount(id);
    const imported = Number(query.imported);
    const showImported = Number.isInteger(imported) && imported >= 0 && query.imported !== undefined;

    return (
      <>
        <PageIntro
          title={account.name}
          lede={`${TYPE_LABELS[account.type]}${account.archived ? " · Archived" : ""}${
            account.institution ? ` · ${account.institution}` : ""
          }${account.matchText ? ` · Match ${account.matchText}` : ""}`}
          action={
            <Link className="button secondary" href={`/accounts/${account.id}/edit`}>
              Edit
            </Link>
          }
        />
        {account.balanceCents !== null ? (
          <p className="stat" style={{ width: "fit-content" }}>
            <span>Balance</span>
            <strong>
              {formatHeldBalance(account.balanceCents, isLiabilityType(account.type))}
            </strong>
          </p>
        ) : null}
        {showImported ? (
          <p className="summary" role="status">
            Imported {imported} transaction{imported === 1 ? "" : "s"}.
          </p>
        ) : null}
        <section className="section">
          <h2>Transactions</h2>
          {transactions.length === 0 ? (
            <p className="muted">
              No transactions yet. <Link href="/import">Import a bank CSV</Link> to add some.
            </p>
          ) : (
            <DataGrid
              rows={transactions.map((transaction, index) => ({
                id: transaction.id,
                href: `/transactions/${transaction.id}/edit`,
                sortKey: String(index).padStart(6, "0"),
                date: formatDate(transaction.postedOn),
                description:
                  transaction.accountId === account.id
                    ? transaction.description
                    : `${transaction.description} · On ${transaction.sourceName}`,
                amountCents: transaction.amountCents,
                account: transaction.matchedName ?? "",
              }))}
              columns={[
                { field: "sortKey", header: "Order", hide: true, sort: "asc" },
                { field: "date", header: "Date", width: 130 },
                { field: "description", header: "Description", flex: 1.4, minWidth: 180 },
                { field: "amountCents", header: "Amount", kind: "moneySigned", width: 120 },
                { field: "account", header: "Linked account", flex: 1, minWidth: 140 },
              ]}
            />
          )}
        </section>
      </>
    );
  } catch (error) {
    logDatabaseError(error);
    return <DatabaseError />;
  }
}
