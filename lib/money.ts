const MONEY_PATTERN = /^-?\d+(\.\d{1,2})?$/;

export function dollarsToCents(input: string): number | null {
  const trimmed = input.trim().replace(/[$,]/g, "");

  if (!MONEY_PATTERN.test(trimmed)) {
    return null;
  }

  const negative = trimmed.startsWith("-");
  const [whole, fraction = ""] = trimmed.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(cents)) {
    return null;
  }

  return negative ? -cents : cents;
}

export function centsToInput(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatHeldBalance(cents: number, liability: boolean): string {
  if (!liability) {
    return formatCents(cents);
  }

  const owed = -cents;
  return owed >= 0 ? `${formatCents(owed)} owed` : `${formatCents(-owed)} credit`;
}
