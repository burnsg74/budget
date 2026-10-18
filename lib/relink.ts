import type { PoolClient } from "pg";
import { suggestMatch } from "../features/import/match";

export async function relinkTransactions(client: PoolClient): Promise<void> {
  const accounts = await client.query<{
    id: number;
    matchText: string;
    archived: boolean;
  }>(`SELECT id, match_text AS "matchText", archived FROM accounts`);
  const transactions = await client.query<{
    id: number;
    description: string;
    accountId: number;
  }>(`SELECT id, description, account_id AS "accountId" FROM transactions`);

  if (transactions.rows.length === 0) {
    return;
  }

  const matchable = accounts.rows.map((account) => ({
    id: Number(account.id),
    matchText: account.matchText,
    archived: account.archived,
  }));
  const ids: number[] = [];
  const matched: number[] = [];

  for (const transaction of transactions.rows) {
    ids.push(Number(transaction.id));
    matched.push(
      suggestMatch(transaction.description, matchable, Number(transaction.accountId)) ?? 0,
    );
  }

  await client.query(
    `UPDATE transactions AS t
     SET matched_account_id = NULLIF(v.matched, 0)
     FROM unnest($1::int[], $2::int[]) AS v(id, matched)
     WHERE t.id = v.id
       AND t.matched_account_id IS DISTINCT FROM NULLIF(v.matched, 0)`,
    [ids, matched],
  );
}

export async function deleteEmptyMatchAccounts(client: PoolClient): Promise<void> {
  await client.query(
    `DELETE FROM accounts a
     WHERE a.type IN ('income', 'bill', 'household', 'other')
       AND NOT EXISTS (
         SELECT 1 FROM transactions t
         WHERE t.account_id = a.id OR t.matched_account_id = a.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM import_batches b
         WHERE b.account_id = a.id
       )`,
  );
}
