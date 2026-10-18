import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccountForm } from "@/features/accounts/account-form";
import { saveAccount } from "@/features/accounts/actions";
import { getAccount } from "@/lib/accounts";
import { DatabaseError, PageIntro, logDatabaseError } from "../../../ui";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="page">
      <Suspense fallback={<PageIntro title="Edit account" lede="Loading…" />}>
        <Editor params={params} />
      </Suspense>
    </main>
  );
}

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  try {
    const account = await getAccount(id);

    if (!account) {
      notFound();
    }

    const action = saveAccount.bind(null, account.id);

    return (
      <>
        <PageIntro
          title={`Edit ${account.name}`}
          action={
            <Link className="button secondary" href={`/accounts/${account.id}`}>
              Back
            </Link>
          }
        />
        <AccountForm action={action} account={account} />
      </>
    );
  } catch (error) {
    logDatabaseError(error);
    return <DatabaseError />;
  }
}
