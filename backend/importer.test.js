import assert from "node:assert/strict";
import { test } from "node:test";
import { ValidationError, importHash } from "./schema.js";
import { findAccountMatch, parseAmountCents, parseBankCsv, parseUsDate } from "./importer.js";

test("parseAmountCents handles bank formats without floats", () => {
  assert.equal(parseAmountCents(".96"), 96);
  assert.equal(parseAmountCents("2000.00"), 200000);
  assert.equal(parseAmountCents("$1,275.35"), 127535);
  assert.equal(parseAmountCents("12"), 1200);
  assert.equal(parseAmountCents(""), null);
  assert.equal(parseAmountCents("  "), null);
  assert.ok(Number.isNaN(parseAmountCents("12.345")));
  assert.ok(Number.isNaN(parseAmountCents("abc")));
});

test("parseUsDate converts MM/DD/YYYY", () => {
  assert.equal(parseUsDate("10/9/2026"), "2026-10-09");
  assert.equal(parseUsDate("10/30/2026"), "2026-10-30");
  assert.equal(parseUsDate("2/30/2026"), null);
  assert.equal(parseUsDate("2026-10-09"), null);
});

test("importHash differs only by occurrence", () => {
  const a = importHash("2026-10-05", "Taco Bell", -1095, 0);
  const b = importHash("2026-10-05", "Taco Bell", -1095, 1);
  assert.notEqual(a, b);
  assert.equal(a, importHash("2026-10-05", "Taco Bell", -1095, 0));
});

test("parseBankCsv maps debit/credit, dates, and same-day duplicates", () => {
  const rows = parseBankCsv(`Account Number,Post Date,Check,Description,Debit,Credit,Status
x,10/26/2026,,Service Charge,.96,,Posted
x,10/15/2026,,Barrelhead Supply Payroll,,1275.35,Posted
x,10/5/2026,,Taco Bell,10.95,,Posted
x,10/5/2026,,Taco Bell,10.95,,Posted
`);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], {
    line: 2,
    posted_on: "2026-10-26",
    description: "Service Charge",
    amount_cents: -96,
    hash: importHash("2026-10-26", "Service Charge", -96, 0),
  });
  assert.equal(rows[1].amount_cents, 127535);
  assert.equal(rows[2].hash, importHash("2026-10-05", "Taco Bell", -1095, 0));
  assert.equal(rows[3].hash, importHash("2026-10-05", "Taco Bell", -1095, 1));
});

test("parseBankCsv rejects missing columns and bad rows", () => {
  assert.throws(() => parseBankCsv("Date,Memo\n1,x"), /Missing CSV column/);
  assert.throws(
    () => parseBankCsv("Post Date,Description,Debit,Credit\n10/1/2026,,5.00,\n"),
    (err) => err instanceof ValidationError && /line 2: missing Description/.test(err.message),
  );
  assert.throws(
    () => parseBankCsv("Post Date,Description,Debit,Credit\n10/1/2026,Both,1.00,2.00\n"),
    /exactly one of Debit or Credit/,
  );
});

test("findAccountMatch is case-insensitive, longest match_text wins, skips archived and excluded", () => {
  const accounts = [
    { name: "Household Checking", match_text: "Household Checking", archived: false },
    { name: "Amazon", match_text: "Amazon", archived: false },
    { name: "AWS", match_text: "Amazon Web Services", archived: false },
    { name: "Old Amazon", match_text: "Amazon Web", archived: true },
  ];
  assert.equal(findAccountMatch("Amazon Web Services", accounts, "Household Checking")?.name, "AWS");
  assert.equal(findAccountMatch("amazon", accounts, "Household Checking")?.name, "Amazon");
  assert.equal(findAccountMatch("Household Checking", accounts, "Household Checking"), null);
  assert.equal(findAccountMatch("Nowhere", accounts, "Household Checking"), null);
});
