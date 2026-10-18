import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { saveTransactionMatch } from "@/features/transactions/actions";
import { TYPE_LABELS } from "@/lib/account-types";
import { listAccounts } from "@/lib/accounts";
import { formatDate } from "@/lib/dates";
import { parseId } from "@/lib/ids";
import { formatCents } from "@/lib/money";
import { query } from "@/lib/db";
import { DatabaseError, PageIntro, logDatabaseError } from "../../ui";

type TransactionDetail = {
  id: number;
  postedOn: string;
  description: string;
  amountCents: number;
  classification: string | null;
  accountId: number;
  sourceName: string;
  matchedAccountId: number | null;
};

export default function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="page">
      <Suspense fallback={<PageIntro title="Transaction" lede="Loading…" />}>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id: rawId } = await params;
  const id = parseId(rawId);

  if (id === null) {
    notFound();
  }

  try {
    const rows = await query<TransactionDetail>(
      `SELECT
        t.id,
        t.posted_on AS "postedOn",
        t.description,
        t.amount_cents AS "amountCents",
        t.classification,
        t.account_id AS "accountId",
        src.name AS "sourceName",
        t.matched_account_id AS "matchedAccountId"
      FROM transactions t
      JOIN accounts src ON src.id = t.account_id
      WHERE t.id = $1`,
      [id],
    );
    const transaction = rows[0];

    if (!transaction) {
      notFound();
    }

    const detail: TransactionDetail = {
      ...transaction,
      id: Number(transaction.id),
      amountCents: Number(transaction.amountCents),
      accountId: Number(transaction.accountId),
      matchedAccountId:
        transaction.matchedAccountId === null ? null : Number(transaction.matchedAccountId),
    };
    const accounts = await listAccounts();
    const month = detail.postedOn.slice(0, 7);

    return (
      <>
        <PageIntro
          title={detail.description}
          lede={`${formatDate(detail.postedOn)} · ${formatCents(detail.amountCents)} · ${detail.sourceName}`}
          action={
            <Link className="button secondary" href={`/transactions?month=${month}`}>
              Back
            </Link>
          }
        />
        {detail.classification ? <p className="help">{detail.classification}</p> : null}
        <form action={saveTransactionMatch} className="form">
          <input type="hidden" name="transactionId" value={detail.id} />
          <input type="hidden" name="returnTo" value={`/transactions/${detail.id}`} />
          <label className="field">
            Linked account
            <select name="matchedAccountId" defaultValue={detail.matchedAccountId ?? ""}>
              <option value="">No match</option>
              {accounts
                .filter(
                  (account) =>
                    account.id !== detail.accountId &&
                    (!account.archived || account.id === detail.matchedAccountId),
                )
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {TYPE_LABELS[account.type]}
                    {account.archived ? " (archived)" : ""}
                  </option>
                ))}
            </select>
          </label>
          <button className="button" type="submit">
            Save
          </button>
        </form>
      </>
    );
  } catch (error) {
    logDatabaseError(error);
    return <DatabaseError />;
  }
}
