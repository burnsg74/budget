import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TYPE_LABELS, isLiabilityType } from "@/lib/account-types";
import {
  getAccount,
  listAccounts,
  listTransactionsForAccount,
} from "@/lib/accounts";
import { formatDate } from "@/lib/dates";
import { formatCents, formatHeldBalance } from "@/lib/money";
import { saveTransactionMatch } from "@/features/transactions/actions";
import { DatabaseError, PageIntro, logDatabaseError } from "../../ui";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const { id } = await params;
  const query = await searchParams;

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  try {
    const account = await getAccount(id);

    if (!account) {
      notFound();
    }

    const [transactions, accounts] = await Promise.all([
      listTransactionsForAccount(id),
      listAccounts(),
    ]);
    const imported = Number(query.imported);
    const showImported = Number.isInteger(imported) && imported >= 0 && query.imported !== undefined;
    const matchOptions = accounts;

    return (
      <>
        <PageIntro
          title={account.name}
          lede={`${TYPE_LABELS[account.type]}${account.archived ? " · Archived" : ""}${
            account.institution ? ` · ${account.institution}` : ""
          }`}
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
              No transactions yet.{" "}
              <Link href="/import">Import a bank CSV</Link> to add some.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th className="num">Amount</th>
                    <th>Linked account</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{formatDate(transaction.postedOn)}</td>
                      <td>
                        {transaction.description}
                        {transaction.classification ? (
                          <span className="sub">{transaction.classification}</span>
                        ) : null}
                        {transaction.accountId !== account.id ? (
                          <span className="sub">On {transaction.sourceName}</span>
                        ) : null}
                      </td>
                      <td
                        className={
                          transaction.amountCents < 0 ? "num negative" : "num positive"
                        }
                      >
                        {formatCents(transaction.amountCents)}
                      </td>
                      <td>
                        <form action={saveTransactionMatch} className="match-form">
                          <input type="hidden" name="transactionId" value={transaction.id} />
                          <input
                            type="hidden"
                            name="returnTo"
                            value={`/accounts/${account.id}`}
                          />
                          <select
                            name="matchedAccountId"
                            defaultValue={transaction.matchedAccountId ?? ""}
                            aria-label={`Link ${transaction.description}`}
                          >
                            <option value="">No match</option>
                            {matchOptions
                              .filter(
                                (item) =>
                                  item.id !== transaction.accountId &&
                                  (!item.archived || item.id === transaction.matchedAccountId),
                              )
                              .map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                  {item.archived ? " (archived)" : ""}
                                </option>
                              ))}
                          </select>
                          <button className="button secondary small" type="submit">
                            Save
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </>
    );
  } catch (error) {
    logDatabaseError(error);
    return <DatabaseError />;
  }
}
