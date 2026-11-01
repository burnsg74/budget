// Bank "AccountHistory" CSV parsing and account matching. Pure functions, no I/O.
import { parseCsv } from "./csv.js";
import { ValidationError, importHash, isIsoDate } from "./schema.js";

export const IMPORT_ACCOUNT = "Household Checking";
const REQUIRED_HEADERS = ["Post Date", "Description", "Debit", "Credit"];

/** "1,234.50", "$.96", "12" -> integer cents. Returns null for blank, NaN for garbage. */
export function parseAmountCents(text) {
  const s = String(text ?? "").replace(/[$,\s]/g, "");
  if (s === "") return null;
  const match = /^(\d*)(?:\.(\d{1,2}))?$/.exec(s);
  if (!match || (match[1] === "" && match[2] === undefined)) return NaN;
  return Number(match[1] || "0") * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0");
}

/** "10/9/2026" -> "2026-10-09", or null when not a real date. */
export function parseUsDate(text) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(text ?? "").trim());
  if (!match) return null;
  const iso = `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  return isIsoDate(iso) ? iso : null;
}

/**
 * Parse bank CSV text into [{ line, posted_on, description, amount_cents, hash }].
 * Only Post Date, Description, Debit and Credit are read. Credits are positive, debits negative.
 * Any invalid row rejects the whole file (ValidationError listing every problem).
 */
export function parseBankCsv(text) {
  const [header, ...rawRows] = parseCsv(String(text ?? ""));
  if (!header) throw new ValidationError("The CSV is empty");
  const index = Object.fromEntries(REQUIRED_HEADERS.map((name) => [name, header.findIndex((h) => h.trim() === name)]));
  const missing = REQUIRED_HEADERS.filter((name) => index[name] < 0);
  if (missing.length) throw new ValidationError(`Missing CSV column(s): ${missing.join(", ")}`);

  const errors = [];
  const rows = [];
  const seen = new Map();
  rawRows.forEach((cells, i) => {
    const line = i + 2;
    const cell = (name) => (cells[index[name]] ?? "").trim();
    const problems = [];

    const posted_on = parseUsDate(cell("Post Date"));
    if (!posted_on) problems.push(`invalid Post Date "${cell("Post Date")}"`);
    const description = cell("Description");
    if (!description) problems.push("missing Description");
    const debit = parseAmountCents(cell("Debit"));
    const credit = parseAmountCents(cell("Credit"));
    if (Number.isNaN(debit) || Number.isNaN(credit)) problems.push("invalid Debit/Credit amount");
    else if ((debit === null) === (credit === null)) problems.push("needs exactly one of Debit or Credit");

    if (problems.length) {
      errors.push(`line ${line}: ${problems.join(", ")}`);
      return;
    }
    const amount_cents = credit !== null ? credit : -debit;
    const key = JSON.stringify([posted_on, description, amount_cents]);
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);
    rows.push({ line, posted_on, description, amount_cents, hash: importHash(posted_on, description, amount_cents, occurrence) });
  });

  if (errors.length) {
    const shown = errors.slice(0, 10).join("; ");
    throw new ValidationError(`Import rejected, nothing was saved. ${shown}${errors.length > 10 ? `; and ${errors.length - 10} more` : ""}`);
  }
  return rows;
}

/**
 * Account whose match_text appears in the description (case-insensitive); longest match_text
 * wins, ties go to the earliest account. Archived accounts and `excludeName` are skipped.
 */
export function findAccountMatch(description, accounts, excludeName = null) {
  const haystack = description.toLowerCase();
  let best = null;
  let bestLength = 0;
  for (const account of accounts) {
    if (account.archived || account.name === excludeName) continue;
    const needle = (account.match_text || account.name).trim().toLowerCase();
    if (needle && needle.length > bestLength && haystack.includes(needle)) {
      best = account;
      bestLength = needle.length;
    }
  }
  return best;
}
