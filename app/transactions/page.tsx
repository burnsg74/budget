import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DataGrid } from "@/features/grid/data-grid";
import { listTransactions } from "@/lib/accounts";
import { DatabaseError, PageIntro, logDatabaseError } from "../ui";

export default function TransactionsPage() {
  return (
    <main className="page">
      <PageIntro
        title="Transactions"
        lede="Posted rows from your imports. Edit changes the linked account."
      />
      <Suspense fallback={<p className="muted">Loading transactions…</p>}>
        <TransactionTable />
      </Suspense>
    </main>
  );
}

async function TransactionTable() {
  await connection();

  try {
    const transactions = await listTransactions();

    if (transactions.length === 0) {
      return (
        <p className="muted">
          No transactions yet. <Link href="/import">Import a bank CSV</Link> to add some.
        </p>
      );
    }

    return (
      <DataGrid
        rows={transactions.map((transaction) => ({
          id: transaction.id,
          href: `/transactions/${transaction.id}/edit`,
          postedOn: transaction.postedOn,
          description: transaction.description,
          source: transaction.sourceName,
          account: transaction.matchedName ?? "",
          amountCents: transaction.amountCents,
        }))}
        columns={[
          { field: "postedOn", header: "Date", kind: "date", width: 130, sort: "desc" },
          { field: "description", header: "Description", flex: 1.6, minWidth: 180 },
          { field: "source", header: "Account", flex: 1, minWidth: 120 },
          { field: "account", header: "Linked account", flex: 1, minWidth: 140 },
          { field: "amountCents", header: "Amount", kind: "moneySigned", width: 120 },
          { field: "edit", header: "", kind: "link", linkLabel: "Edit", width: 72 },
        ]}
      />
    );
  } catch (error) {
    logDatabaseError(error);
    return <DatabaseError />;
  }
}
