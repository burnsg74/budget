import {
  isBalanceType,
  type AccountType,
} from "./account-types";
import { getPool, query } from "./db";
import { deleteEmptyMatchAccounts, relinkTransactions } from "./relink";

export type AccountRecord = {
  id: number;
  name: string;
  matchText: string;
  type: AccountType;
  institution: string | null;
  mask: string | null;
  openingBalanceCents: number;
  openingOn: string | null;
  expectedAmountCents: number | null;
  dueDay: number | null;
  scheduleActive: boolean;
  archived: boolean;
  balanceCents: number | null;
};

export type AccountInput = {
  name: string;
  matchText: string;
  type: AccountType;
  institution: string | null;
  mask: string | null;
  openingBalanceCents: number;
  openingOn: string | null;
  expectedAmountCents: number | null;
  dueDay: number | null;
  scheduleActive: boolean;
  archived: boolean;
};

export type TransactionRecord = {
  id: number;
  accountId: number;
  matchedAccountId: number | null;
  postedOn: string;
  description: string;
  amountCents: number;
  checkNumber: string | null;
  status: string;
  classification: string | null;
  sourceName: string;
  matchedName: string | null;
};

const ACCOUNT_COLUMNS = `
  a.id,
  a.name,
  a.match_text AS "matchText",
  a.type,
  a.institution,
  a.mask,
  a.opening_balance_cents AS "openingBalanceCents",
  a.opening_on AS "openingOn",
  a.expected_amount_cents AS "expectedAmountCents",
  a.due_day AS "dueDay",
  a.schedule_active AS "scheduleActive",
  a.archived,
  CASE
    WHEN a.type IN ('checking', 'credit_card', 'loan') THEN
      a.opening_balance_cents
      + COALESCE((
          SELECT SUM(t.amount_cents)
          FROM transactions t
          WHERE t.account_id = a.id
            AND t.status = 'Posted'
            AND a.opening_on IS NOT NULL
            AND t.posted_on > a.opening_on
        ), 0)
      + COALESCE((
          SELECT SUM(-t.amount_cents)
          FROM transactions t
          WHERE a.type IN ('credit_card', 'loan')
            AND t.matched_account_id = a.id
            AND t.account_id <> a.id
            AND t.status = 'Posted'
            AND a.opening_on IS NOT NULL
            AND t.posted_on > a.opening_on
        ), 0)
    ELSE NULL
  END::bigint AS "balanceCents"
`;

function mapAccount(row: AccountRecord): AccountRecord {
  return {
    ...row,
    id: Number(row.id),
    type: row.type,
    openingBalanceCents: Number(row.openingBalanceCents),
    expectedAmountCents:
      row.expectedAmountCents === null ? null : Number(row.expectedAmountCents),
    dueDay: row.dueDay === null ? null : Number(row.dueDay),
    balanceCents: row.balanceCents === null ? null : Number(row.balanceCents),
  };
}

export async function listAccounts(): Promise<AccountRecord[]> {
  const rows = await query<AccountRecord>(
    `SELECT ${ACCOUNT_COLUMNS} FROM accounts a ORDER BY a.name`,
  );
  return rows.map(mapAccount);
}

export async function getAccount(id: number): Promise<AccountRecord | null> {
  const rows = await query<AccountRecord>(
    `SELECT ${ACCOUNT_COLUMNS} FROM accounts a WHERE a.id = $1`,
    [id],
  );
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function insertAccount(input: AccountInput): Promise<number> {
  const rows = await query<{ id: number }>(
    `INSERT INTO accounts (
      name, match_text, type, institution, mask, opening_balance_cents, opening_on,
      expected_amount_cents, due_day, schedule_active, archived
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id`,
    [
      input.name,
      input.matchText,
      input.type,
      input.institution,
      input.mask,
      input.openingBalanceCents,
      input.openingOn,
      input.expectedAmountCents,
      input.dueDay,
      input.scheduleActive,
      input.archived,
    ],
  );
  return Number(rows[0].id);
}

export async function saveAccountRecord(
  id: number,
  input: AccountInput,
  previousMatchText: string,
): Promise<{ deleted: boolean }> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE accounts SET
        name = $2,
        match_text = $3,
        type = $4,
        institution = $5,
        mask = $6,
        opening_balance_cents = $7,
        opening_on = $8,
        expected_amount_cents = $9,
        due_day = $10,
        schedule_active = $11,
        archived = $12
      WHERE id = $1`,
      [
        id,
        input.name,
        input.matchText,
        input.type,
        input.institution,
        input.mask,
        input.openingBalanceCents,
        input.openingOn,
        input.expectedAmountCents,
        input.dueDay,
        input.scheduleActive,
        input.archived,
      ],
    );

    if ((updated.rowCount ?? 0) === 0) {
      throw new Error("That account no longer exists.");
    }

    let deleted = false;

    if (previousMatchText.trim() !== input.matchText.trim()) {
      await relinkTransactions(client);
      await deleteEmptyMatchAccounts(client);
      const still = await client.query(`SELECT 1 FROM accounts WHERE id = $1`, [id]);
      deleted = (still.rowCount ?? 0) === 0;
    }

    await client.query("COMMIT");
    return { deleted };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listTransactionsForAccount(
  accountId: number,
): Promise<TransactionRecord[]> {
  const rows = await query<TransactionRecord>(
    `SELECT
      t.id,
      t.account_id AS "accountId",
      t.matched_account_id AS "matchedAccountId",
      t.posted_on AS "postedOn",
      t.description,
      t.amount_cents AS "amountCents",
      t.check_number AS "checkNumber",
      t.status,
      t.classification,
      src.name AS "sourceName",
      m.name AS "matchedName"
    FROM transactions t
    JOIN accounts src ON src.id = t.account_id
    LEFT JOIN accounts m ON m.id = t.matched_account_id
    WHERE t.account_id = $1 OR t.matched_account_id = $1
    ORDER BY t.posted_on DESC, t.created_at DESC`,
    [accountId],
  );
  return rows.map(mapTransaction);
}

function mapTransaction(row: TransactionRecord): TransactionRecord {
  return {
    ...row,
    id: Number(row.id),
    accountId: Number(row.accountId),
    matchedAccountId: row.matchedAccountId === null ? null : Number(row.matchedAccountId),
    amountCents: Number(row.amountCents),
  };
}

export async function updateTransactionMatch(
  transactionId: number,
  matchedAccountId: number | null,
): Promise<void> {
  await query(
    `UPDATE transactions
     SET matched_account_id = $2
     WHERE id = $1`,
    [transactionId, matchedAccountId],
  );
}

export async function getTransactionAccountId(
  transactionId: number,
): Promise<{ accountId: number; matchedAccountId: number | null } | null> {
  const rows = await query<{ accountId: number; matchedAccountId: number | null }>(
    `SELECT account_id AS "accountId", matched_account_id AS "matchedAccountId"
     FROM transactions WHERE id = $1`,
    [transactionId],
  );
  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    accountId: Number(row.accountId),
    matchedAccountId: row.matchedAccountId === null ? null : Number(row.matchedAccountId),
  };
}

export function showsBalance(account: AccountRecord): boolean {
  return isBalanceType(account.type) && account.balanceCents !== null;
}
