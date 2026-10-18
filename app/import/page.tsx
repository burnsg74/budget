import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ImportWizard } from "@/features/import/import-wizard";
import { listAccounts } from "@/lib/accounts";
import { DatabaseError, PageIntro, logDatabaseError } from "../ui";

export default function ImportPage() {
  return (
    <main className="page">
      <PageIntro
        title="Import"
        lede="Posted rows are kept. Duplicates and anything that is not Posted are left out. Descriptions are matched to account names."
      />
      <Suspense fallback={<p className="muted">Loading accounts…</p>}>
        <Importer />
      </Suspense>
    </main>
  );
}

async function Importer() {
  await connection();

  try {
    const accounts = (await listAccounts()).filter((account) => !account.archived);

    if (accounts.length === 0) {
      return (
        <p className="muted">
          Create an account before importing.{" "}
          <Link href="/accounts/new">New account</Link>
        </p>
      );
    }

    return (
      <ImportWizard
        accounts={accounts.map((account) => ({
          id: account.id,
          name: account.name,
          type: account.type,
        }))}
      />
    );
  } catch (error) {
    logDatabaseError(error);
    return <DatabaseError />;
  }
}
