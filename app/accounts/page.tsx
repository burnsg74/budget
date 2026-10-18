import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ACCOUNT_TYPES, TYPE_LABELS, isLiabilityType } from "@/lib/account-types";
import { listAccounts, type AccountRecord } from "@/lib/accounts";
import { formatHeldBalance } from "@/lib/money";
import { DatabaseError, PageIntro, logDatabaseError } from "../ui";

export default function AccountsPage() {
  return (
    <main className="page">
      <PageIntro
        title="Accounts"
        lede="Checking, cards, and loans keep a balance. Other accounts are names an import can match."
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
        {ACCOUNT_TYPES.map((type) => {
          const group = active.filter((account) => account.type === type);

          if (group.length === 0) {
            return null;
          }

          return (
            <section className="section" key={type}>
              <h2>{TYPE_LABELS[type]}</h2>
              <AccountRows accounts={group} />
            </section>
          );
        })}
        {archived.length > 0 ? (
          <section className="section">
            <h2>Archived</h2>
            <AccountRows accounts={archived} />
          </section>
        ) : null}
      </>
    );
  } catch (error) {
    logDatabaseError(error);
    return <DatabaseError />;
  }
}

function AccountRows({ accounts }: { accounts: AccountRecord[] }) {
  return (
    <ul className="account-list">
      {accounts.map((account) => (
        <li key={account.id}>
          <Link href={`/accounts/${account.id}`}>
            <span>
              {account.name}
              {account.mask ? <span className="sub">•••• {account.mask}</span> : null}
            </span>
            <span className="money">
              {account.balanceCents === null
                ? TYPE_LABELS[account.type]
                : formatHeldBalance(account.balanceCents, isLiabilityType(account.type))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
