import { query } from "../../lib/db";
import { fingerprint } from "./fingerprint";
import { suggestMatch, type MatchableAccount } from "./match";
import { parseBankCsv, type SkippedRow } from "./parse-csv";

export type PlannedRow = {
  line: number;
  fingerprint: string;
  postedOn: string;
  description: string;
  amountCents: number;
  checkNumber: string | null;
  status: string;
  classification: string | null;
  matchedAccountId: string | null;
  duplicate: boolean;
};

export async function planImport(input: {
  csvText: string;
  accountId: string;
  accounts: MatchableAccount[];
  matches?: Record<string, string | null>;
}): Promise<{ rows: PlannedRow[]; skipped: SkippedRow[]; errors: string[] }> {
  const parsed = parseBankCsv(input.csvText);

  if (parsed.errors.length > 0 && parsed.rows.length === 0 && parsed.skipped.length === 0) {
    return { rows: [], skipped: [], errors: parsed.errors };
  }

  const allowed = new Set(
    input.accounts
      .filter((account) => !account.archived && account.id !== input.accountId)
      .map((account) => account.id),
  );
  const occurrences = new Map<string, number>();
  const planned: PlannedRow[] = parsed.rows.map((row) => {
    const key = JSON.stringify([
      row.postedOn,
      row.description,
      row.amountCents,
      row.checkNumber ?? "",
    ]);
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    const rowFingerprint = fingerprint([
      input.accountId,
      row.postedOn,
      row.description,
      row.amountCents,
      row.checkNumber ?? "",
      occurrence,
    ]);
    const suggested = suggestMatch(row.description, input.accounts, input.accountId);
    const override = input.matches?.[rowFingerprint];
    const matchedAccountId =
      override === undefined
        ? suggested
        : override && allowed.has(override)
          ? override
          : null;

    return {
      line: row.line,
      fingerprint: rowFingerprint,
      postedOn: row.postedOn,
      description: row.description,
      amountCents: row.amountCents,
      checkNumber: row.checkNumber,
      status: row.status,
      classification: row.classification,
      matchedAccountId,
      duplicate: false,
    };
  });

  const fingerprints = planned.map((row) => row.fingerprint);
  const existing =
    fingerprints.length === 0
      ? []
      : await query<{ fingerprint: string }>(
          `SELECT fingerprint FROM transactions WHERE fingerprint = ANY($1::text[])`,
          [fingerprints],
        );
  const existingSet = new Set(existing.map((row) => row.fingerprint));

  for (const row of planned) {
    row.duplicate = existingSet.has(row.fingerprint);
  }

  return { rows: planned, skipped: parsed.skipped, errors: parsed.errors };
}
