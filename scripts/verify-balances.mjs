// Spot-check: recompute balances from the CSVs with the shared JS and diff them against the
// old Postgres app's SQL balances (same query as 3001-budget/lib/accounts.ts).
//   node scripts/verify-balances.mjs [dev|prod]      default prod (real data, matches the DB)
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { resolveConfig } from "../backend/config.js";
import { parseAccounts, parseTransactions } from "../backend/schema.js";
import { balancesByName } from "../frontend/src/lib/balances.js";

const mode = process.argv[2] ?? "prod";
if (mode === "dev") {
  console.log("dev data is synthetic and will not match the DB; checking CSV integrity only.");
}
const config = resolveConfig({ ...process.env, NODE_ENV: "production" });
const dir = mode === "dev" ? config.devDir : config.prodDir;
const accounts = parseAccounts(readFileSync(path.join(dir, "accounts.csv"), "utf8"));
const transactions = parseTransactions(readFileSync(path.join(dir, "transactions.csv"), "utf8"));

let ok = true;
const check = (label, pass, detail = "") => {
  console.log(`${pass ? "ok  " : "FAIL"} ${label}${detail ? ` ${detail}` : ""}`);
  ok &&= pass;
};

const names = new Set(accounts.map((a) => a.name));
const hashes = new Set(transactions.map((t) => t.hash));
check("unique account names", names.size === accounts.length, `(${accounts.length})`);
check("unique transaction hashes", hashes.size === transactions.length, `(${transactions.length})`);
check(
  "all account refs resolve",
  transactions.every((t) => names.has(t.account) && (!t.matched_account || names.has(t.matched_account))),
);

if (mode === "prod") {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || "postgres://greg@localhost:5432/budget" });
  const { rows } = await pool.query(`
    SELECT a.name,
      (a.opening_balance_cents
       + COALESCE((SELECT SUM(t.amount_cents) FROM transactions t
                   WHERE t.account_id = a.id AND t.status = 'Posted'
                     AND a.opening_on IS NOT NULL AND t.posted_on > a.opening_on), 0)
       + COALESCE((SELECT SUM(-t.amount_cents) FROM transactions t
                   WHERE a.type IN ('credit_card','loan') AND t.matched_account_id = a.id
                     AND t.account_id <> a.id AND t.status = 'Posted'
                     AND a.opening_on IS NOT NULL AND t.posted_on > a.opening_on), 0))::bigint AS cents
    FROM accounts a
    WHERE a.type IN ('checking','credit_card','loan') AND a.opening_on IS NOT NULL`);
  const counts = await pool.query(`SELECT (SELECT count(*) FROM accounts)::int AS a, (SELECT count(*) FROM transactions)::int AS t`);
  await pool.end();

  check("account row count matches DB", counts.rows[0].a === accounts.length);
  check("transaction row count matches DB", counts.rows[0].t === transactions.length);

  const mine = balancesByName(accounts, transactions);
  check("same set of tracked accounts", mine.size === rows.length);
  for (const row of rows) {
    const got = mine.get(row.name);
    check(`balance ${row.name}`, got === Number(row.cents), `csv=${got} sql=${row.cents}`);
  }
}

process.exit(ok ? 0 : 1);
