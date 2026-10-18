import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DataGrid } from "@/features/grid/data-grid";
import { TYPE_LABELS, isLiabilityType } from "@/lib/account-types";
import { listAccounts, type AccountRecord } from "@/lib/accounts";
import { formatHeldBalance } from "@/lib/money";
import { DatabaseError, PageIntro, logDatabaseError } from "../ui";

export default function AccountsPage() {
  return (
    <main className="page">
      <PageIntro
        title="Accounts"
        lede="Checking, cards, and loans keep a balance. Match text is what an import looks for."
        action={
          <Link className="button" href="/accounts/new">
            New account
          </Link>
        }
      />
      <Suspense fallback={<p className="muted">Loading accounts…</p>}>
        <AccountList />
      </Suspense>
    </main>
  );
}

async function AccountList() {
  await connection();

  try {
    const accounts = await listAccounts();
    const active = accounts.filter((account) => !account.archived);
    const archived = accounts.filter((account) => account.archived);

    if (accounts.length === 0) {
      return (
        <p className="muted">
          No accounts yet. Create a checking account before importing a bank file.
        </p>
      );
    }

    return (
      <>
        <AccountGrid accounts={active} />
        {archived.length > 0 ? (
          <section className="section">
            <h2>Archived</h2>
            <AccountGrid accounts={archived} />
          </section>
        ) : null}
      </>
    );
  } catch (error) {
    logDatabaseError(error);
    return <DatabaseError />;
  }
}

function AccountGrid({ accounts }: { accounts: AccountRecord[] }) {
  return (
    <DataGrid
      rows={accounts.map((account) => ({
        id: account.id,
        href: `/accounts/${account.id}`,
        name: account.mask ? `${account.name} · ${account.mask}` : account.name,
        type: TYPE_LABELS[account.type],
        match: account.matchText,
        balance:
          account.balanceCents === null
            ? ""
            : formatHeldBalance(account.balanceCents, isLiabilityType(account.type)),
      }))}
      columns={[
        { field: "name", header: "Name", flex: 1.2, minWidth: 160 },
        { field: "type", header: "Type", width: 130 },
        { field: "match", header: "Match", flex: 1, minWidth: 140 },
        { field: "balance", header: "Balance", align: "right", minWidth: 140 },
      ]}
    />
  );
}
