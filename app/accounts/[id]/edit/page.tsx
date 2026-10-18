import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccountForm } from "@/features/accounts/account-form";
import { saveAccount } from "@/features/accounts/actions";
import { getAccount } from "@/lib/accounts";
import { parseId } from "@/lib/ids";
import { DatabaseError, PageIntro, logDatabaseError } from "../../../ui";

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
  const { id: rawId } = await params;
  const id = parseId(rawId);

  if (id === null) {
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
