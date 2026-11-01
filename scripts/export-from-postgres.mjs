// One-shot export: Postgres `budget` DB -> accounts.csv + transactions.csv (no ids).
//
//   node scripts/export-from-postgres.mjs prod [--force]   real data -> vault 10 Projects/Budget/data/
//   node scripts/export-from-postgres.mjs dev  [--force]   synthetic copy -> repo data/dev/
//
// Foreign keys become account NAMES. transactions.hash is seeded from the old fingerprint
// (prod) so identities stay stable; the dev copy re-derives hashes from the scrubbed values.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { resolveConfig } from "../backend/config.js";
import { stringifyAccounts, stringifyTransactions, uniqueHash } from "../backend/schema.js";

const [mode, ...flags] = process.argv.slice(2);
const force = flags.includes("--force");

if (mode !== "prod" && mode !== "dev") {
  console.error("usage: export-from-postgres.mjs <prod|dev> [--force]");
  process.exit(1);
}

const config = resolveConfig({ ...process.env, NODE_ENV: "production" });
const outDir = mode === "prod" ? config.prodDir : config.devDir;
const files = ["accounts.csv", "transactions.csv"].map((f) => path.join(outDir, f));

if (!force && files.some(existsSync)) {
  console.error(`Refusing to overwrite existing files in ${outDir} (pass --force).`);
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgres://greg@localhost:5432/budget",
});

const iso = (d) => (d instanceof Date ? d.toISOString() : d ? String(d) : "");
const day = (d) => {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  // pg returns local-midnight Dates for `date` columns
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const { rows: accountRows } = await pool.query(
  `SELECT id, name, match_text, type, institution, mask, opening_balance_cents, opening_on,
          expected_amount_cents, due_day, schedule_active, archived, created_at
   FROM accounts ORDER BY created_at, id`,
);
const { rows: txRows } = await pool.query(
  `SELECT id, account_id, matched_account_id, posted_on, description, amount_cents,
          check_number, status, classification, fingerprint, created_at
   FROM transactions ORDER BY posted_on, created_at, id`,
);
await pool.end();

// ---- pre-flight -------------------------------------------------------------
const nameById = new Map(accountRows.map((a) => [a.id, a.name]));
const names = new Set(accountRows.map((a) => a.name));
if (names.size !== accountRows.length) fail("Duplicate account names; resolve before exporting.");
if (new Set(txRows.map((t) => t.fingerprint)).size !== txRows.length) fail("Duplicate fingerprints.");
if (txRows.some((t) => t.matched_account_id !== null && t.matched_account_id === t.account_id)) {
  fail("Transaction with matched_account == account.");
}

let accounts = accountRows.map((a) => ({
  name: a.name,
  match_text: a.match_text,
  type: a.type,
  institution: a.institution,
  mask: a.mask,
  opening_balance_cents: Number(a.opening_balance_cents),
  opening_on: day(a.opening_on),
  expected_amount_cents: a.expected_amount_cents === null ? null : Number(a.expected_amount_cents),
  due_day: a.due_day,
  schedule_active: a.schedule_active,
  archived: a.archived,
  created_at: iso(a.created_at),
}));

let transactions = txRows.map((t) => ({
  hash: t.fingerprint,
  account: nameById.get(t.account_id),
  matched_account: t.matched_account_id === null ? null : nameById.get(t.matched_account_id),
  posted_on: day(t.posted_on),
  description: t.description,
  amount_cents: Number(t.amount_cents),
  check_number: t.check_number,
  status: t.status,
  classification: t.classification,
  created_at: iso(t.created_at),
}));

if (mode === "dev") ({ accounts, transactions } = scrub(accounts, transactions));

// ---- write ------------------------------------------------------------------
mkdirSync(outDir, { recursive: true });
writeFileSync(files[0], stringifyAccounts(accounts));
writeFileSync(files[1], stringifyTransactions(transactions));
console.log(`${mode}: wrote ${accounts.length} accounts, ${transactions.length} transactions -> ${outDir}`);

function fail(message) {
  console.error(`export failed: ${message}`);
  process.exit(1);
}

// ---- synthetic scrub for the committed dev copy -------------------------------
function scrub(accts, txs) {
  // Deterministic PRNG so re-exports are stable.
  let seed = 4001;
  const rand = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const jitter = (cents) => (cents === null ? null : Math.round(cents * (0.6 + rand() * 0.8)));

  // Structural names carry no personal info and matter for the app's transfer logic.
  const keep = {
    Barrelhead: "Barrelhead",
    "Household Checking": "Household Checking",
    Deposit: "Deposit",
    "Funds Transfer": "Funds Transfer",
    "Transfer to Loan": "Transfer to Loan",
    "Automatic Loan Payment": "Automatic Loan Payment",
    "Transfer Charge": "Transfer Charge",
    "Gsat Incorporat Payroll": "Spouse Payroll",
    "Col Ext Transfer External F Alexander G Bur": "Alex Transfer",
    "Merchant Refund Terminal Rqba Bi Obsidian Oakville": "Merchant Refund",
    "Transfer From Deposit System Account": "Account Transfer",
    "Chase Credit Card": "Card Payment",
    PennyMac: "Home Loan",
    "1st National": "Credit Card",
    Amazon: "Online Store",
  };
  const billNames = ["Electric Co", "Streaming Service", "Water District", "Phone Carrier", "Internet Provider"];
  const counters = { bill: 0, other: 0, household: 0, income: 0, credit_card: 0, loan: 0, checking: 0 };
  const rename = new Map();

  for (const a of [...accts].sort((x, y) => x.name.localeCompare(y.name))) {
    if (keep[a.name]) {
      rename.set(a.name, keep[a.name]);
    } else if (a.type === "bill") {
      rename.set(a.name, billNames[counters.bill++] ?? `Bill ${counters.bill}`);
    } else {
      counters[a.type]++;
      const label = a.type === "other" ? "Merchant" : a.type === "income" ? "Income Source" : "Account";
      rename.set(a.name, `${label} ${String(counters[a.type]).padStart(2, "0")}`);
    }
  }
  if (new Set(rename.values()).size !== rename.size) fail("scrub produced duplicate names");

  const newAccounts = accts.map((a) => {
    const name = rename.get(a.name);
    return {
      ...a,
      name,
      match_text: name,
      institution: a.institution ? "Sample Bank" : null,
      mask: a.mask ? "0000" : null,
      opening_balance_cents: jitter(a.opening_balance_cents),
      expected_amount_cents: jitter(a.expected_amount_cents),
    };
  });

  const seen = new Set();
  const newTxs = txs.map((t, i) => {
    const account = rename.get(t.account);
    const matched = t.matched_account === null ? null : rename.get(t.matched_account);
    const description = matched ? `${matched} #${String(i + 1).padStart(3, "0")}` : `Transaction #${String(i + 1).padStart(3, "0")}`;
    const amount = jitter(t.amount_cents);
    const hash = uniqueHash([account, t.posted_on, description, amount, t.check_number], seen);
    seen.add(hash);
    return { ...t, hash, account, matched_account: matched, description, amount_cents: amount };
  });

  return { accounts: newAccounts, transactions: newTxs };
}
