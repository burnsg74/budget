import { getPool } from "../../lib/db";
import { planImport } from "./plan";
import type { MatchableAccount } from "./match";

export async function commitImport(input: {
  accountId: string;
  fileName: string;
  csvText: string;
  accounts: MatchableAccount[];
  matches: Record<string, string | null>;
}): Promise<{ inserted: number; duplicates: number; skippedStatus: number }> {
  const plan = await planImport({
    csvText: input.csvText,
    accountId: input.accountId,
    accounts: input.accounts,
    matches: input.matches,
  });
  const fresh = plan.rows.filter((row) => !row.duplicate);
  const client = await getPool().connect();
  let inserted = 0;

  try {
    await client.query("BEGIN");

    for (const row of fresh) {
      const result = await client.query(
        `INSERT INTO transactions (
          account_id, matched_account_id, posted_on, description, amount_cents,
          check_number, status, classification, fingerprint
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (fingerprint) DO NOTHING`,
        [
          input.accountId,
          row.matchedAccountId,
          row.postedOn,
          row.description,
          row.amountCents,
          row.checkNumber,
          row.status,
          row.classification,
          row.fingerprint,
        ],
      );
      inserted += result.rowCount ?? 0;
    }

    await client.query(
      `INSERT INTO import_batches (
        account_id, file_name, skipped_status_count, duplicate_count, inserted_count
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        input.accountId,
        input.fileName,
        plan.skipped.length,
        plan.rows.length - fresh.length + (fresh.length - inserted),
        inserted,
      ],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return {
    inserted,
    duplicates: plan.rows.length - inserted,
    skippedStatus: plan.skipped.length,
  };
}
