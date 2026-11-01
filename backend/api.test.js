import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseCsv, stringifyCsv } from "./csv.js";
import { createApp } from "./server.js";
import { makeHash, uniqueHash } from "./schema.js";

const here = path.dirname(fileURLToPath(import.meta.url));
let dir;
let server;
let base;

before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "budget-test-"));
  await cp(path.join(here, "..", "data", "dev"), dir, { recursive: true });
  server = createApp({ mode: "test", dir });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
});

const call = async (method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

test("csv roundtrip with quotes, commas, newlines", () => {
  const rows = [["a,b", 'say "hi"', "line1\nline2", " padded "]];
  const parsed = parseCsv(stringifyCsv(["w", "x", "y", "z"], rows));
  assert.deepEqual(parsed[1], rows[0]);
});

test("health lists readable data", async () => {
  const { status, body } = await call("GET", "/api/health");
  assert.equal(status, 200);
  assert.equal(body.accountsReadable, true);
});

test("loads seeded data", async () => {
  const { body } = await call("GET", "/api/data");
  assert.equal(body.accounts.length, 53);
  assert.equal(body.transactions.length, 261);
  assert.equal(typeof body.accounts[0].opening_balance_cents, "number");
});

test("account create: unique name enforced", async () => {
  const created = await call("POST", "/api/accounts", { name: "Test Bill", type: "bill" });
  assert.equal(created.status, 201);
  assert.equal(created.body.match_text, "Test Bill");
  const dup = await call("POST", "/api/accounts", { name: "Test Bill", type: "bill" });
  assert.equal(dup.status, 409);
  const bad = await call("POST", "/api/accounts", { name: "Nope", type: "bogus" });
  assert.equal(bad.status, 400);
});

test("rename cascades into transactions", async () => {
  const before = (await call("GET", "/api/transactions")).body;
  const target = before.find((t) => t.matched_account === "Online Store");
  assert.ok(target);
  const count = before.filter((t) => t.account === "Online Store" || t.matched_account === "Online Store").length;

  const res = await call("PATCH", `/api/accounts/${encodeURIComponent("Online Store")}`, { name: "Web Shop" });
  assert.equal(res.status, 200);
  assert.equal(res.body.renamedTransactions, count);

  const after = (await call("GET", "/api/transactions")).body;
  assert.equal(after.filter((t) => t.matched_account === "Online Store").length, 0);
  assert.equal(after.find((t) => t.hash === target.hash).matched_account, "Web Shop");

  const clash = await call("PATCH", `/api/accounts/${encodeURIComponent("Web Shop")}`, { name: "Barrelhead" });
  assert.equal(clash.status, 409);
});

test("transaction create gets a unique hash; hash is immutable; delete works", async () => {
  const input = { account: "Household Checking", matched_account: "Barrelhead", posted_on: "2026-10-20", description: "Manual", amount_cents: 12345 };
  const a = await call("POST", "/api/transactions", input);
  const b = await call("POST", "/api/transactions", input);
  assert.equal(a.status, 201);
  assert.notEqual(a.body.hash, b.body.hash); // same-day duplicates are allowed
  assert.equal(a.body.hash, makeHash(["Household Checking", "2026-10-20", "Manual", 12345, null], 0));

  const patched = await call("PATCH", `/api/transactions/${a.body.hash}`, { hash: "evil", amount_cents: "500" });
  assert.equal(patched.body.hash, a.body.hash);
  assert.equal(patched.body.amount_cents, 500);

  const badRef = await call("PATCH", `/api/transactions/${a.body.hash}`, { matched_account: "Nowhere" });
  assert.equal(badRef.status, 400);
  const self = await call("PATCH", `/api/transactions/${a.body.hash}`, { matched_account: "Household Checking" });
  assert.equal(self.status, 400);

  assert.equal((await call("DELETE", `/api/transactions/${a.body.hash}`)).status, 200);
  assert.equal((await call("DELETE", `/api/transactions/${a.body.hash}`)).status, 404);
});

test("cannot delete an account that transactions use", async () => {
  const res = await call("DELETE", `/api/accounts/${encodeURIComponent("Barrelhead")}`);
  assert.equal(res.status, 409);
  const free = await call("DELETE", `/api/accounts/${encodeURIComponent("Test Bill")}`);
  assert.equal(free.status, 200);
});

test("writes land in the csv file", async () => {
  const text = await readFile(path.join(dir, "accounts.csv"), "utf8");
  assert.match(text, /Web Shop/);
  assert.doesNotMatch(text, /Test Bill/);
});

test("files api: list, read csv, refuse traversal and reserved writes", async () => {
  const list = await call("GET", "/api/files");
  assert.deepEqual(list.body.files, ["accounts.csv", "transactions.csv"]);
  const csv = await call("GET", "/api/files/accounts.csv");
  assert.equal(csv.body.rows[0].name.length > 0, true);
  assert.equal((await call("GET", "/api/files/..%2Fpackage.json")).status, 400);
  assert.equal((await call("GET", "/api/files/%2Fetc%2Fpasswd.md")).status, 400);
  assert.equal((await call("PUT", "/api/files/accounts.csv", { rows: [] })).status, 405);
  const put = await call("PUT", "/api/files/notes/readme.md", { content: "---\ntitle: Hi\n---\nbody" });
  assert.equal(put.status, 200);
  const read = await call("GET", "/api/files/notes/readme.md");
  assert.equal(read.body.frontmatter.title, "Hi");
});

test("uniqueHash skips taken hashes", () => {
  const parts = ["a", "2026-01-01", "d", 1, null];
  const taken = new Set([makeHash(parts, 0), makeHash(parts, 1)]);
  assert.equal(uniqueHash(parts, taken), makeHash(parts, 2));
});
