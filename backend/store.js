// CSV-backed store. All mutations are serialized, validated, and written atomically
// (temp file + rename). Reads always come from disk so edits made in an editor or synced by
// Dropbox show up on the next request.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ACCOUNT_COLUMNS,
  TRANSACTION_COLUMNS,
  parseAccounts,
  parseTransactions,
  stringifyAccounts,
  stringifyTransactions,
  uniqueHash,
  validateAccount,
  validateTransaction,
} from "./schema.js";
import { IMPORT_ACCOUNT, findAccountMatch } from "./importer.js";

export class NotFoundError extends Error {}
export class ConflictError extends Error {}

export const ACCOUNTS_FILE = "accounts.csv";
export const TRANSACTIONS_FILE = "transactions.csv";

const ACCOUNT_FIELDS = new Set(ACCOUNT_COLUMNS);
const TRANSACTION_FIELDS = new Set(TRANSACTION_COLUMNS);

export const IO_TIMEOUT_MS = 5000;

export class DataAccessError extends Error {}

// On macOS a launchd-started node (pm2 at login) can block forever reading Dropbox's
// File Provider folder until the node binary is granted Full Disk Access. Without a guard,
// every request would park a libuv thread and the API would stop answering. So: time out
// with an actionable message, and share one in-flight read per file.
function withTimeout(promise, what) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new DataAccessError(
            `Timed out ${what}. If this runs under pm2/launchd on macOS, grant Full Disk Access to ${process.execPath} ` +
              "(System Settings > Privacy & Security > Full Disk Access) and restart budget-api.",
          ),
        ),
      IO_TIMEOUT_MS,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const inflightReads = new Map();

function readText(file) {
  let pending = inflightReads.get(file);
  if (!pending) {
    pending = readFile(file, "utf8")
      .catch((error) => {
        if (error.code === "ENOENT") return "";
        throw error;
      })
      .finally(() => inflightReads.delete(file));
    inflightReads.set(file, pending);
  }
  return withTimeout(pending, `reading ${path.basename(file)}`);
}

async function writeAtomic(file, text) {
  await withTimeout(
    (async () => {
      await mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, text, "utf8");
      await rename(tmp, file);
    })(),
    `writing ${path.basename(file)}`,
  );
}

/** Real read (not just access()) so health reflects whether the data can actually be used. */
export async function probeReadable(file) {
  try {
    await readText(file);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

const nowIso = () => new Date().toISOString();

// Coerce loosely-typed JSON from the UI into record field types.
function coerceAccount(input) {
  const out = { ...input };
  const int = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
  if ("opening_balance_cents" in out) out.opening_balance_cents = int(out.opening_balance_cents) ?? 0;
  if ("expected_amount_cents" in out) out.expected_amount_cents = int(out.expected_amount_cents);
  if ("due_day" in out) out.due_day = int(out.due_day);
  for (const key of ["institution", "mask", "opening_on", "anchor_on"]) {
    if (key in out && (out[key] === "" || out[key] === undefined)) out[key] = null;
  }
  if ("cadence" in out && (out.cadence === "" || out.cadence === undefined || out.cadence === null)) out.cadence = "day";
  for (const key of ["schedule_active", "archived"]) {
    if (key in out) out[key] = out[key] === true || out[key] === "true";
  }
  if (typeof out.name === "string") out.name = out.name.trim();
  return out;
}

function coerceTransaction(input) {
  const out = { ...input };
  if ("amount_cents" in out) out.amount_cents = Number(out.amount_cents);
  for (const key of ["matched_account", "check_number", "classification"]) {
    if (key in out && (out[key] === "" || out[key] === undefined)) out[key] = null;
  }
  return out;
}

function pick(input, allowed) {
  const out = {};
  for (const key of Object.keys(input ?? {})) {
    if (allowed.has(key)) out[key] = input[key];
  }
  return out;
}

export function createStore(dir) {
  const accountsPath = path.join(dir, ACCOUNTS_FILE);
  const transactionsPath = path.join(dir, TRANSACTIONS_FILE);
  let queue = Promise.resolve();

  async function load() {
    const [a, t] = await Promise.all([readText(accountsPath), readText(transactionsPath)]);
    return { accounts: a ? parseAccounts(a) : [], transactions: t ? parseTransactions(t) : [] };
  }

  // Serialize read-modify-write cycles. `fn(state)` mutates state and returns
  // { result, accounts?: bool, transactions?: bool } describing what to persist.
  function mutate(fn) {
    const run = queue.then(async () => {
      const state = await load();
      const outcome = await fn(state);
      if (new Set(state.accounts.map((acc) => acc.name)).size !== state.accounts.length) throw new ConflictError("Duplicate account name");
      if (new Set(state.transactions.map((t) => t.hash)).size !== state.transactions.length) {
        throw new ConflictError("Duplicate transaction hash");
      }
      // Write accounts first: transactions only ever reference names that already exist.
      if (outcome.accounts) await writeAtomic(accountsPath, stringifyAccounts(state.accounts));
      if (outcome.transactions) await writeAtomic(transactionsPath, stringifyTransactions(state.transactions));
      return outcome.result;
    });
    queue = run.catch(() => {});
    return run;
  }

  return {
    dir,
    accountsPath,
    transactionsPath,
    load,

    listAccounts: async () => (await load()).accounts,
    listTransactions: async () => (await load()).transactions,

    createAccount(input) {
      return mutate((state) => {
        const base = coerceAccount(pick(input, ACCOUNT_FIELDS));
        const account = {
          name: "",
          match_text: "",
          type: "other",
          institution: null,
          mask: null,
          opening_balance_cents: 0,
          opening_on: null,
          expected_amount_cents: null,
          due_day: null,
          cadence: "day",
          anchor_on: null,
          schedule_active: false,
          archived: false,
          ...base,
          created_at: nowIso(),
        };
        if (!account.match_text) account.match_text = account.name;
        validateAccount(account);
        if (state.accounts.some((a) => a.name === account.name)) {
          throw new ConflictError(`An account named "${account.name}" already exists`);
        }
        state.accounts.push(account);
        return { result: account, accounts: true };
      });
    },

    updateAccount(name, patch) {
      return mutate((state) => {
        const index = state.accounts.findIndex((a) => a.name === name);
        if (index < 0) throw new NotFoundError(`No account named "${name}"`);
        const changes = coerceAccount(pick(patch, ACCOUNT_FIELDS));
        delete changes.created_at;
        const next = { ...state.accounts[index], ...changes };
        validateAccount(next);

        const renamed = next.name !== name;
        if (renamed && state.accounts.some((a) => a.name === next.name)) {
          throw new ConflictError(`An account named "${next.name}" already exists`);
        }
        state.accounts[index] = next;

        let updated = 0;
        if (renamed) {
          // match_text is independent of the name; only transaction references follow the rename.
          for (const t of state.transactions) {
            let touched = false;
            if (t.account === name) (t.account = next.name), (touched = true);
            if (t.matched_account === name) (t.matched_account = next.name), (touched = true);
            if (touched) updated++;
          }
        }
        return {
          result: { account: state.accounts[index], renamedTransactions: updated },
          accounts: true,
          transactions: renamed && updated > 0,
        };
      });
    },

    deleteAccount(name) {
      return mutate((state) => {
        const index = state.accounts.findIndex((a) => a.name === name);
        if (index < 0) throw new NotFoundError(`No account named "${name}"`);
        const refs = state.transactions.filter((t) => t.account === name || t.matched_account === name).length;
        if (refs > 0) {
          throw new ConflictError(`"${name}" is used by ${refs} transaction(s); archive it instead`);
        }
        state.accounts.splice(index, 1);
        return { result: { deleted: name }, accounts: true };
      });
    },

    createTransaction(input) {
      return mutate((state) => {
        const base = coerceTransaction(pick(input, TRANSACTION_FIELDS));
        const tx = {
          account: "",
          matched_account: null,
          posted_on: "",
          description: "",
          amount_cents: 0,
          check_number: null,
          status: "Posted",
          classification: null,
          ...base,
          hash: "",
          created_at: nowIso(),
        };
        const names = new Set(state.accounts.map((a) => a.name));
        tx.hash = uniqueHash(
          [tx.account, tx.posted_on, tx.description, tx.amount_cents, tx.check_number],
          new Set(state.transactions.map((t) => t.hash)),
        );
        validateTransaction(tx, names);
        state.transactions.push(tx);
        return { result: tx, transactions: true };
      });
    },

    /**
     * Import parsed bank rows (see parseBankCsv) into IMPORT_ACCOUNT. Rows whose hash already
     * exists are skipped. Each row is linked to the account whose match_text is in its
     * description; when none matches, an account named after the description is created.
     */
    importTransactions(rows) {
      return mutate((state) => {
        const now = nowIso();
        const newAccount = (fields) => {
          const account = {
            name: "",
            match_text: "",
            type: "other",
            institution: null,
            mask: null,
            opening_balance_cents: 0,
            opening_on: null,
            expected_amount_cents: null,
            due_day: null,
            cadence: "day",
            anchor_on: null,
            schedule_active: false,
            archived: false,
            ...fields,
            created_at: now,
          };
          validateAccount(account);
          state.accounts.push(account);
          return account;
        };

        const accountsCreated = [];
        let target = state.accounts.find((a) => a.name === IMPORT_ACCOUNT);
        if (!target) {
          target = newAccount({ name: IMPORT_ACCOUNT, match_text: IMPORT_ACCOUNT, type: "checking" });
          accountsCreated.push(target.name);
        }

        const hashes = new Set(state.transactions.map((t) => t.hash));
        let added = 0;
        let skipped = 0;
        for (const row of rows) {
          if (hashes.has(row.hash)) {
            skipped++;
            continue;
          }
          let matched = findAccountMatch(row.description, state.accounts, target.name);
          if (!matched) {
            const lower = row.description.toLowerCase();
            matched = state.accounts.find((a) => a.name.toLowerCase() === lower && a.name !== target.name);
          }
          if (!matched) {
            matched = newAccount({ name: row.description, match_text: row.description });
            accountsCreated.push(matched.name);
          }
          const tx = {
            hash: row.hash,
            account: target.name,
            matched_account: matched.name,
            posted_on: row.posted_on,
            description: row.description,
            amount_cents: row.amount_cents,
            check_number: null,
            status: "Posted",
            classification: null,
            created_at: now,
          };
          validateTransaction(tx, new Set(state.accounts.map((a) => a.name)));
          state.transactions.push(tx);
          hashes.add(row.hash);
          added++;
        }

        return {
          result: { totalRows: rows.length, added, skipped, accountsCreated },
          accounts: accountsCreated.length > 0,
          transactions: added > 0,
        };
      });
    },

    updateTransaction(hash, patch) {
      return mutate((state) => {
        const index = state.transactions.findIndex((t) => t.hash === hash);
        if (index < 0) throw new NotFoundError("Transaction not found");
        const changes = coerceTransaction(pick(patch, TRANSACTION_FIELDS));
        delete changes.hash; // identity is immutable
        delete changes.created_at;
        const next = { ...state.transactions[index], ...changes };
        validateTransaction(next, new Set(state.accounts.map((a) => a.name)));
        state.transactions[index] = next;
        return { result: next, transactions: true };
      });
    },

    deleteTransaction(hash) {
      return mutate((state) => {
        const index = state.transactions.findIndex((t) => t.hash === hash);
        if (index < 0) throw new NotFoundError("Transaction not found");
        state.transactions.splice(index, 1);
        return { result: { deleted: hash }, transactions: true };
      });
    },
  };
}
