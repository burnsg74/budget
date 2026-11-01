import assert from "node:assert/strict";
import { test } from "node:test";
import { ValidationError, parseAccounts, stringifyAccounts, validateAccount } from "./schema.js";

const account = (over) => ({
  name: "Pay",
  match_text: "Pay",
  type: "income",
  institution: null,
  mask: null,
  opening_balance_cents: 0,
  opening_on: null,
  expected_amount_cents: 100,
  due_day: null,
  cadence: "day",
  anchor_on: null,
  schedule_active: false,
  archived: false,
  created_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

test("old account rows default to day-of-month", () => {
  const csv = [
    "name,match_text,type,institution,mask,opening_balance_cents,opening_on,expected_amount_cents,due_day,schedule_active,archived,created_at",
    "Rent,Rent,bill,,,0,,80000,1,true,false,2026-01-01T00:00:00.000Z",
  ].join("\n");
  const [rent] = parseAccounts(csv);
  assert.equal(rent.cadence, "day");
  assert.equal(rent.anchor_on, null);
  assert.equal(rent.due_day, 1);
  assert.equal(rent.schedule_active, true);
});

test("cadence and anchor round-trip through the csv", () => {
  const text = stringifyAccounts([account({ cadence: "biweekly", anchor_on: "2026-10-15", schedule_active: true })]);
  const [pay] = parseAccounts(text);
  assert.equal(pay.cadence, "biweekly");
  assert.equal(pay.anchor_on, "2026-10-15");
  assert.match(text.split("\n")[0], /due_day,cadence,anchor_on,schedule_active/);
});

test("biweekly schedule requires an anchor date", () => {
  const biweekly = account({ cadence: "biweekly", schedule_active: true });
  assert.throws(
    () => validateAccount(biweekly),
    (err) => err instanceof ValidationError && /anchor date/.test(err.message),
  );
  validateAccount({ ...biweekly, anchor_on: "2026-10-15" });
  validateAccount({ ...biweekly, schedule_active: false });
  assert.throws(
    () => validateAccount(account({ cadence: "weekly" })),
    (err) => err instanceof ValidationError && /Invalid cadence/.test(err.message),
  );
});
