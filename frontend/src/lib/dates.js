// ISO date (YYYY-MM-DD) and month (YYYY-MM) helpers. Local-time safe; no UTC drift.

export function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayIso() {
  return toIsoDate(new Date());
}

export function monthOf(iso) {
  return iso.slice(0, 7);
}

export function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(y, m - 1, d),
  );
}

export function formatShortDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(y, m - 1, d));
}

export function formatMonth(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(y, m - 1, 1));
}

export function formatMonthLong(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function eachDate(from, to) {
  const out = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) out.push(cursor);
  return out;
}

export function shiftMonth(yearMonth, delta) {
  const [y, m] = yearMonth.split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthBounds(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { start: `${yearMonth}-01`, end: `${yearMonth}-${String(lastDay).padStart(2, "0")}`, lastDay };
}

/** Inclusive list of YYYY-MM from `from` to `to`. */
export function monthRange(from, to) {
  const out = [];
  for (let cursor = from; cursor <= to && out.length < 240; cursor = shiftMonth(cursor, 1)) out.push(cursor);
  return out;
}

export function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
