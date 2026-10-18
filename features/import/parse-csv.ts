import { parse } from "csv-parse/sync";
import { dollarsToCents } from "../../lib/money";

export type ParsedRow = {
  line: number;
  postedOn: string;
  description: string;
  amountCents: number;
  checkNumber: string | null;
  status: string;
  classification: string | null;
};

export type SkippedRow = {
  line: number;
  postedOn: string;
  description: string;
  status: string;
};

const REQUIRED_COLUMNS = ["Post Date", "Description", "Debit", "Credit", "Status"];

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

export function decodeHtml(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (entity, body: string) => {
    if (body.startsWith("#")) {
      const codePoint =
        body[1] === "x" || body[1] === "X"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);

      if (!Number.isFinite(codePoint)) {
        return entity;
      }

      return String.fromCodePoint(codePoint);
    }

    return NAMED_ENTITIES[body] ?? entity;
  });
}

export function parseBankCsv(text: string): {
  rows: ParsedRow[];
  skipped: SkippedRow[];
  errors: string[];
} {
  let records: Record<string, string>[];

  try {
    records = parse(text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n"), {
      columns: (headers: string[]) =>
        headers.map((header) => header.replace(/^\uFEFF/, "").trim()),
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    }) as Record<string, string>[];
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown parse error";
    return {
      rows: [],
      skipped: [],
      errors: [`This file is not a readable CSV. ${detail}`],
    };
  }

  if (records.length === 0) {
    return { rows: [], skipped: [], errors: ["The CSV has no data rows."] };
  }

  const columns = new Set(Object.keys(records[0] ?? {}));
  const missing = REQUIRED_COLUMNS.filter((column) => !columns.has(column));

  if (missing.length > 0) {
    return {
      rows: [],
      skipped: [],
      errors: [`Missing columns: ${missing.join(", ")}.`],
    };
  }

  const rows: ParsedRow[] = [];
  const skipped: SkippedRow[] = [];
  const errors: string[] = [];

  records.forEach((record, index) => {
    const line = index + 2;
    const description = decodeHtml(record.Description ?? "").trim();
    const status = (record.Status ?? "").trim();
    const postedRaw = record["Post Date"] ?? "";

    if (status.toLowerCase() !== "posted") {
      skipped.push({
        line,
        postedOn: postedRaw,
        description: description || "Blank description",
        status: status || "Blank",
      });
      return;
    }

    const postedOn = parseUsDate(postedRaw);

    if (!postedOn) {
      errors.push(`Row ${line} has a date that is not MM/DD/YYYY.`);
      return;
    }

    if (!description) {
      errors.push(`Row ${line} has no description.`);
      return;
    }

    const amount = amountFromColumns(record.Debit, record.Credit);

    if (amount.error) {
      errors.push(`Row ${line} ${amount.error}`);
      return;
    }

    const checkNumber = (record.Check ?? "").trim() || null;
    const classification = decodeHtml(record.Classification ?? "").trim() || null;

    rows.push({
      line,
      postedOn,
      description,
      amountCents: amount.cents ?? 0,
      checkNumber,
      status: "Posted",
      classification,
    });
  });

  return { rows, skipped, errors };
}

function parseUsDate(value: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function amountFromColumns(
  debit: string | undefined,
  credit: string | undefined,
): { cents: number | null; error: string | null } {
  const debitCents = debit?.trim() ? dollarsToCents(debit) : null;
  const creditCents = credit?.trim() ? dollarsToCents(credit) : null;

  if (debit?.trim() && debitCents === null) {
    return { cents: null, error: "has a debit that is not a dollar amount." };
  }

  if (credit?.trim() && creditCents === null) {
    return { cents: null, error: "has a credit that is not a dollar amount." };
  }

  if (debitCents !== null && creditCents !== null) {
    return { cents: null, error: "has both a debit and a credit." };
  }

  if (debitCents === null && creditCents === null) {
    return { cents: null, error: "has no debit or credit." };
  }

  if (debitCents !== null) {
    return { cents: -Math.abs(debitCents), error: null };
  }

  return { cents: Math.abs(creditCents ?? 0), error: null };
}
