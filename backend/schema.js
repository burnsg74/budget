// CSV schemas, row <-> record conversion, validation, and transaction hashing.
import { createHash } from "node:crypto";
import { parseCsvObjects, stringifyCsv } from "./csv.js";

export const ACCOUNT_TYPES = ["checking", "income", "credit_card", "loan", "overdraft", "bill", "household", "other"];

/** day = due day of the month; biweekly = every 14 days from anchor_on; month = once a month, no fixed day. */
export const CADENCES = ["day", "biweekly", "month"];

export const ACCOUNT_COLUMNS = [
  "name",
  "match_text",
  "type",
  "opening_balance_cents",
  "opening_on",
  "expected_amount_cents",
  "due_day",
  "cadence",
  "anchor_on",
  "schedule_active",
  "archived",
  "created_at",
];

export const TRANSACTION_COLUMNS = [
  "hash",
  "account",
  "matched_account",
  "posted_on",
  "description",
  "amount_cents",
  "check_number",
  "status",
  "classification",
  "created_at",
];

export class ValidationError extends Error {}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value) {
  if (typeof value !== "string" || !isoDate.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const toIntOrNull = (value) => (value === "" || value === null || value === undefined ? null : Number(value));
const toStr = (value) => (value === null || value === undefined ? "" : String(value));
const toBool = (value) => value === true || value === "true" || value === "t" || value === "1";

export function accountFromRow(row) {
  return {
    name: row.name,
    match_text: row.match_text,
    type: row.type,
    opening_balance_cents: Number(row.opening_balance_cents || 0),
    opening_on: row.opening_on || null,
    expected_amount_cents: toIntOrNull(row.expected_amount_cents),
    due_day: toIntOrNull(row.due_day),
    cadence: row.cadence || "day",
    anchor_on: row.anchor_on || null,
    schedule_active: toBool(row.schedule_active),
    archived: toBool(row.archived),
    created_at: row.created_at || "",
  };
}

export function accountToRow(a) {
  return [
    a.name,
    a.match_text,
    a.type,
    toStr(a.opening_balance_cents ?? 0),
    toStr(a.opening_on),
    toStr(a.expected_amount_cents),
    toStr(a.due_day),
    a.cadence || "day",
    toStr(a.anchor_on),
    a.schedule_active ? "true" : "false",
    a.archived ? "true" : "false",
    toStr(a.created_at),
  ];
}

export function transactionFromRow(row) {
  return {
    hash: row.hash,
    account: row.account,
    matched_account: row.matched_account || null,
    posted_on: row.posted_on,
    description: row.description,
    amount_cents: Number(row.amount_cents),
    check_number: row.check_number || null,
    status: row.status,
    classification: row.classification || null,
    created_at: row.created_at || "",
  };
}

export function transactionToRow(t) {
  return [
    t.hash,
    t.account,
    toStr(t.matched_account),
    t.posted_on,
    t.description,
    toStr(t.amount_cents),
    toStr(t.check_number),
    t.status,
    toStr(t.classification),
    toStr(t.created_at),
  ];
}

export function parseAccounts(text) {
  return parseCsvObjects(text).map(accountFromRow);
}

export function parseTransactions(text) {
  return parseCsvObjects(text).map(transactionFromRow);
}

export function stringifyAccounts(accounts) {
  return stringifyCsv(ACCOUNT_COLUMNS, accounts.map(accountToRow));
}

export function stringifyTransactions(transactions) {
  return stringifyCsv(TRANSACTION_COLUMNS, transactions.map(transactionToRow));
}

/**
 * Latest posted date that can serve as a biweekly payday anchor.
 * Income uses the last deposit; everything else uses the last posted touch.
 */
export function lastAnchorOn(account, transactions) {
  const name = account.name;
  const depositsOnly = account.type === "income";
  let latest = null;
  for (const t of transactions) {
    if (t.status !== "Posted") continue;
    if (t.account !== name && t.matched_account !== name) continue;
    if (depositsOnly && !(t.amount_cents > 0)) continue;
    if (!latest || t.posted_on > latest) latest = t.posted_on;
  }
  return latest;
}

/** Throws ValidationError when a (full) account record is invalid. */
export function validateAccount(a) {
  if (typeof a.name !== "string" || a.name.trim() === "") throw new ValidationError("Name is required");
  if (a.name !== a.name.trim()) throw new ValidationError("Name cannot start or end with whitespace");
  if (!ACCOUNT_TYPES.includes(a.type)) throw new ValidationError(`Invalid type: ${a.type}`);
  if (!Number.isSafeInteger(a.opening_balance_cents)) throw new ValidationError("Opening balance must be integer cents");
  if (a.opening_on !== null && !isIsoDate(a.opening_on)) throw new ValidationError("Opening date must be YYYY-MM-DD");
  if (a.expected_amount_cents !== null && !Number.isSafeInteger(a.expected_amount_cents)) {
    throw new ValidationError("Expected amount must be integer cents");
  }
  if (a.due_day !== null && !(Number.isInteger(a.due_day) && a.due_day >= 1 && a.due_day <= 31)) {
    throw new ValidationError("Due day must be 1-31");
  }
  const cadence = a.cadence || "day";
  if (!CADENCES.includes(cadence)) throw new ValidationError(`Invalid cadence: ${a.cadence}`);
  if (a.anchor_on !== null && a.anchor_on !== undefined && !isIsoDate(a.anchor_on)) {
    throw new ValidationError("Anchor date must be YYYY-MM-DD");
  }
  if (cadence === "biweekly" && a.schedule_active && !isIsoDate(a.anchor_on)) {
    throw new ValidationError("Every 2 weeks needs an anchor date");
  }
  if (typeof a.schedule_active !== "boolean" || typeof a.archived !== "boolean") {
    throw new ValidationError("schedule_active and archived must be booleans");
  }
}

/** Throws ValidationError when a (full) transaction record is invalid. */
export function validateTransaction(t, accountNames) {
  if (!t.hash) throw new ValidationError("hash is required");
  if (!t.account || !accountNames.has(t.account)) throw new ValidationError(`Unknown account: ${t.account}`);
  if (t.matched_account !== null && !accountNames.has(t.matched_account)) {
    throw new ValidationError(`Unknown matched account: ${t.matched_account}`);
  }
  if (t.matched_account !== null && t.matched_account === t.account) {
    throw new ValidationError("Matched account must differ from account");
  }
  if (!isIsoDate(t.posted_on)) throw new ValidationError("Posted date must be YYYY-MM-DD");
  if (typeof t.description !== "string" || t.description.trim() === "") {
    throw new ValidationError("Description is required");
  }
  if (!Number.isSafeInteger(t.amount_cents)) throw new ValidationError("Amount must be integer cents");
  if (!t.status) throw new ValidationError("Status is required");
}

/**
 * Stable transaction identity. `occurrence` disambiguates otherwise-identical rows
 * (same account/date/description/amount/check), the same way the old fingerprint did.
 */
export function makeHash(parts, occurrence = 0) {
  const [account, postedOn, description, amountCents, checkNumber] = parts;
  return createHash("sha256")
    .update(JSON.stringify([account, postedOn, description, amountCents, checkNumber ?? "", occurrence]))
    .digest("hex");
}

/**
 * Identity for bank-CSV imports: only post date, description and amount, plus `occurrence`
 * (index among identical rows in the same file) so repeated same-day rows stay distinct
 * while re-importing the same rows is detected.
 */
export function importHash(postedOn, description, amountCents, occurrence = 0) {
  return createHash("sha256")
    .update(JSON.stringify([postedOn, description, amountCents, occurrence]))
    .digest("hex");
}

/** First hash for these parts that is not already in `existing` (a Set). */
export function uniqueHash(parts, existing) {
  let occurrence = 0;
  let hash = makeHash(parts, occurrence);
  while (existing.has(hash)) hash = makeHash(parts, ++occurrence);
  return hash;
}
