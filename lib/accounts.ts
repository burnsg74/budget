import {
  isBalanceType,
  type AccountType,
} from "./account-types";
import { query } from "./db";

export type AccountRecord = {
  id: string;
  name: string;
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
  id: string;
  accountId: string;
  matchedAccountId: string | null;
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

export async function getAccount(id: string): Promise<AccountRecord | null> {
  const rows = await query<AccountRecord>(
    `SELECT ${ACCOUNT_COLUMNS} FROM accounts a WHERE a.id = $1`,
    [id],
  );
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function insertAccount(input: AccountInput): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO accounts (
      name, type, institution, mask, opening_balance_cents, opening_on,
      expected_amount_cents, due_day, schedule_active, archived
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id`,
    [
      input.name,
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
  return rows[0].id;
}

export async function updateAccount(
  id: string,
  input: AccountInput,
): Promise<void> {
  await query(
    `UPDATE accounts SET
      name = $2,
      type = $3,
      institution = $4,
      mask = $5,
      opening_balance_cents = $6,
      opening_on = $7,
      expected_amount_cents = $8,
      due_day = $9,
      schedule_active = $10,
      archived = $11
    WHERE id = $1`,
    [
      id,
      input.name,
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
}

export async function listTransactionsForAccount(
  accountId: string,
): Promise<TransactionRecord[]> {
  return query<TransactionRecord>(
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
}

export async function updateTransactionMatch(
  transactionId: string,
  matchedAccountId: string | null,
): Promise<void> {
  await query(
    `UPDATE transactions
     SET matched_account_id = $2
     WHERE id = $1`,
    [transactionId, matchedAccountId],
  );
}

export async function getTransactionAccountId(
  transactionId: string,
): Promise<{ accountId: string; matchedAccountId: string | null } | null> {
  const rows = await query<{ accountId: string; matchedAccountId: string | null }>(
    `SELECT account_id AS "accountId", matched_account_id AS "matchedAccountId"
     FROM transactions WHERE id = $1`,
    [transactionId],
  );
  return rows[0] ?? null;
}

export function showsBalance(account: AccountRecord): boolean {
  return isBalanceType(account.type) && account.balanceCents !== null;
}
