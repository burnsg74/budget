// Budget API. node:http only, loopback bound, no auth (local machine only).
import { createServer } from "node:http";
import { access, constants, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCsv, stringifyCsv } from "./csv.js";
import {
  ACCOUNTS_FILE,
  ConflictError,
  DataAccessError,
  NotFoundError,
  TRANSACTIONS_FILE,
  createStore,
  probeReadable,
} from "./store.js";
import { ValidationError } from "./schema.js";
import { parseBankCsv } from "./importer.js";

const MAX_BODY = 5 * 1024 * 1024;
const FILE_EXTENSIONS = new Set([".md", ".csv"]);
// These two are only writable through the validated /api/accounts and /api/transactions routes.
const RESERVED_FILES = new Set([ACCOUNTS_FILE, TRANSACTIONS_FILE]);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(text);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, "Body too large");
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

/** Resolve a relative path inside `root`; refuses absolute paths and traversal. */
export function safeResolve(root, relative) {
  if (typeof relative !== "string" || relative === "" || relative.includes("\0")) {
    throw new HttpError(400, "Invalid path");
  }
  if (path.isAbsolute(relative)) throw new HttpError(400, "Absolute paths are not allowed");
  const parts = relative.split(/[\\/]+/);
  if (parts.some((p) => p === ".." || p === "")) throw new HttpError(400, "Invalid path");
  if (!FILE_EXTENSIONS.has(path.extname(relative).toLowerCase())) {
    throw new HttpError(400, "Only .md and .csv files are available");
  }
  const full = path.resolve(root, relative);
  if (!full.startsWith(path.resolve(root) + path.sep)) throw new HttpError(400, "Invalid path");
  return full;
}

async function listFiles(root, dir = root) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const out = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(root, full)));
    else if (FILE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      out.push(path.relative(root, full).split(path.sep).join("/"));
    }
  }
  return out.sort();
}

function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { frontmatter: null, body: text };
  const frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([^:#\s][^:]*):\s*(.*)$/.exec(line);
    if (kv) frontmatter[kv[1].trim()] = kv[2].trim();
  }
  return { frontmatter, body: text.slice(match[0].length) };
}

export function createApp(config, store = createStore(config.dir)) {
  async function handle(req, res) {
    const url = new URL(req.url, "http://localhost");
    const pathname = url.pathname;
    const method = req.method;
    let segments;
    try {
      segments = pathname.split("/").filter(Boolean).map(decodeURIComponent); // ["api", ...]
    } catch {
      throw new HttpError(400, "Malformed URL");
    }

    if (segments[0] !== "api") throw new HttpError(404, "Not found");
    const [, resource, id] = segments;

    if (resource === "health" && method === "GET") {
      const exists = async (p) => access(p, constants.R_OK).then(() => true, () => false);
      const [accounts, transactions] = await Promise.all([
        probeReadable(store.accountsPath),
        probeReadable(store.transactionsPath),
      ]);
      const ok = accounts.ok && transactions.ok;
      return send(res, ok ? 200 : 503, {
        ok,
        env: config.mode,
        dataDir: store.dir,
        dataDirReadable: await exists(store.dir),
        accountsReadable: accounts.ok,
        transactionsReadable: transactions.ok,
        ...(ok ? {} : { error: accounts.error ?? transactions.error }),
      });
    }

    if (resource === "data" && method === "GET") return send(res, 200, await store.load());

    if (resource === "accounts") {
      if (!id && method === "GET") return send(res, 200, await store.listAccounts());
      if (!id && method === "POST") return send(res, 201, await store.createAccount(await readJson(req)));
      if (id && method === "PATCH") return send(res, 200, await store.updateAccount(id, await readJson(req)));
      if (id && method === "DELETE") return send(res, 200, await store.deleteAccount(id));
    }

    if (resource === "transactions") {
      if (!id && method === "GET") return send(res, 200, await store.listTransactions());
      if (!id && method === "POST") return send(res, 201, await store.createTransaction(await readJson(req)));
      if (id && method === "PATCH") return send(res, 200, await store.updateTransaction(id, await readJson(req)));
      if (id && method === "DELETE") return send(res, 200, await store.deleteTransaction(id));
    }

    if (resource === "import" && !id && method === "POST") {
      const body = await readJson(req);
      if (typeof body.csv !== "string") throw new HttpError(400, "Body needs csv: string");
      return send(res, 200, await store.importTransactions(parseBankCsv(body.csv)));
    }

    if (resource === "files") {
      const rel = segments.slice(2).join("/");
      if (!rel && method === "GET") return send(res, 200, { files: await listFiles(store.dir) });

      if (rel && method === "GET") {
        const full = safeResolve(store.dir, rel);
        let text;
        try {
          text = await readFile(full, "utf8");
        } catch (error) {
          if (error.code === "ENOENT") throw new HttpError(404, "File not found");
          throw error;
        }
        if (rel.toLowerCase().endsWith(".csv")) {
          const [header = [], ...rows] = parseCsv(text);
          return send(res, 200, {
            path: rel,
            columns: header,
            rows: rows.map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]))),
          });
        }
        const { frontmatter, body } = parseFrontmatter(text);
        return send(res, 200, { path: rel, content: text, frontmatter, body });
      }

      if (rel && method === "PUT") {
        if (RESERVED_FILES.has(rel)) {
          throw new HttpError(405, `${rel} is edited through /api/accounts and /api/transactions`);
        }
        const full = safeResolve(store.dir, rel);
        const body = await readJson(req);
        let text;
        if (rel.toLowerCase().endsWith(".csv")) {
          if (!Array.isArray(body.rows)) throw new HttpError(400, "CSV body needs rows: [...]");
          const columns = body.columns ?? Object.keys(body.rows[0] ?? {});
          text = stringifyCsv(columns, body.rows.map((r) => columns.map((c) => r[c] ?? "")));
        } else {
          if (typeof body.content !== "string") throw new HttpError(400, "Body needs content: string");
          text = body.content;
        }
        await mkdir(path.dirname(full), { recursive: true });
        const tmp = `${full}.${process.pid}.tmp`;
        await writeFile(tmp, text, "utf8");
        await rename(tmp, full);
        return send(res, 200, { path: rel, bytes: Buffer.byteLength(text) });
      }
    }

    throw new HttpError(404, "Not found");
  }

  return createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (error) {
      if (error instanceof HttpError) return send(res, error.status, { error: error.message });
      if (error instanceof ValidationError) return send(res, 400, { error: error.message });
      if (error instanceof NotFoundError) return send(res, 404, { error: error.message });
      if (error instanceof ConflictError) return send(res, 409, { error: error.message });
      if (error instanceof DataAccessError) return send(res, 503, { error: error.message });
      console.error(error);
      send(res, 500, { error: "Internal error" });
    }
  });
}