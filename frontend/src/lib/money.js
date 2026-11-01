const MONEY_PATTERN = /^-?\d+(\.\d{1,2})?$/;

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** "$1,234.50" / "-12.3" -> integer cents, or null when unparseable. */
export function dollarsToCents(input) {
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) : null;
  const trimmed = String(input ?? "")
    .trim()
    .replace(/[$,]/g, "");
  if (!MONEY_PATTERN.test(trimmed)) return null;
  const negative = trimmed.startsWith("-");
  const [whole, fraction = ""] = trimmed.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

/** Plain editable string: 12345 -> "123.45". */
export function centsToInput(cents) {
  if (cents === null || cents === undefined) return "";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function formatCents(cents) {
  if (cents === null || cents === undefined) return "";
  return currency.format(cents / 100);
}

/** Liabilities store negative balances; show them as "owed". */
export function formatHeldBalance(cents, liability) {
  if (cents === null || cents === undefined) return "";
  if (!liability) return formatCents(cents);
  const owed = -cents;
  return owed >= 0 ? `${formatCents(owed)} owed` : `${formatCents(-owed)} credit`;
}
