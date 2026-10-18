"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { listAccounts, type AccountRecord } from "../../lib/accounts";
import { parseId } from "../../lib/ids";
import { commitImport } from "./commit";
import { planImport } from "./plan";
import type { PlannedRow } from "./plan";
import type { SkippedRow } from "./parse-csv";

export type PreviewState =
  | {
      ok: true;
      accountId: number;
      fileName: string;
      rows: PlannedRow[];
      skipped: SkippedRow[];
      errors: string[];
    }
  | { ok: false; error: string }
  | null;

export type CommitState = { error: string } | null;

export async function previewImport(
  _previous: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  const loaded = await loadCsv(formData);

  if (!loaded.ok) {
    return { ok: false, error: loaded.error };
  }

  const plan = await planImport({
    csvText: loaded.csvText,
    accountId: loaded.accountId,
    accounts: loaded.accounts,
  });

  if (plan.rows.length === 0 && plan.skipped.length === 0) {
    return { ok: false, error: plan.errors[0] ?? "Nothing in that file could be read." };
  }

  return {
    ok: true,
    accountId: loaded.accountId,
    fileName: loaded.fileName,
    rows: plan.rows,
    skipped: plan.skipped,
    errors: plan.errors,
  };
}

export async function confirmImport(
  _previous: CommitState,
  formData: FormData,
): Promise<CommitState> {
  const loaded = await loadCsv(formData);

  if (!loaded.ok) {
    return { error: loaded.error };
  }

  let matches: Record<string, string | null> = {};

  try {
    const parsed = JSON.parse(String(formData.get("matches") ?? "{}")) as unknown;
    matches = sanitizeMatches(parsed);
  } catch {
    return { error: "The match list could not be read. Preview the file again." };
  }

  const result = await commitImport({
    accountId: loaded.accountId,
    fileName: loaded.fileName,
    csvText: loaded.csvText,
    accounts: loaded.accounts,
    matches,
  });

  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath(`/accounts/${loaded.accountId}`);
  revalidatePath("/reports");
  revalidatePath("/transactions");
  redirect(`/accounts/${loaded.accountId}?imported=${result.inserted}`);
}

async function loadCsv(formData: FormData): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      accountId: number;
      fileName: string;
      csvText: string;
      accounts: AccountRecord[];
    }
> {
  const accountId = parseId(String(formData.get("accountId") ?? ""));
  const file = formData.get("file");

  if (accountId === null) {
    return { ok: false, error: "Choose the account this file belongs to." };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a CSV file." };
  }

  if (file.size > 2_000_000) {
    return { ok: false, error: "File is larger than 2 MB." };
  }

  const accounts = await listAccounts();
  const account = accounts.find((item) => item.id === accountId);

  if (!account || account.archived) {
    return { ok: false, error: "Choose an account that is still active." };
  }

  return {
    ok: true,
    accountId,
    fileName: file.name.replace(/[/\\]/g, "").slice(0, 200) || "import.csv",
    csvText: await file.text(),
    accounts,
  };
}

function sanitizeMatches(value: unknown): Record<string, string | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const matches: Record<string, string | null> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (!/^[0-9a-f]{64}$/.test(key)) {
      continue;
    }

    if (typeof entry === "string" && /^[1-9]\d{0,8}$/.test(entry)) {
      matches[key] = entry;
    } else if (typeof entry === "string" && entry.startsWith("new:") && entry.length <= 600) {
      matches[key] = entry;
    } else {
      matches[key] = null;
    }
  }

  return matches;
}
