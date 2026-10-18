"use client";

import type { ColDef, ICellRendererParams } from "ag-grid-community";
import dynamic from "next/dynamic";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TYPE_LABELS, type AccountType } from "../../lib/account-types";
import { formatDate } from "../../lib/dates";
import { formatCents } from "../../lib/money";
import {
  confirmImport,
  previewImport,
  type CommitState,
  type PreviewState,
} from "./actions";

const AgTable = dynamic(() => import("../grid/ag-table").then((mod) => mod.AgTable), {
  ssr: false,
  loading: () => <p className="muted">Loading table…</p>,
});

type AccountOption = {
  id: number;
  name: string;
  type: AccountType;
};

type ImportGridRow = {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  linkValue: string;
  createKey: string | null;
  createName: string | null;
};

export function ImportWizard({ accounts }: { accounts: AccountOption[] }) {
  const [preview, previewAction, previewPending] = useActionState(previewImport, null);
  const [file, setFile] = useState<File | null>(null);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const fileRef = useRef(file);
  const matchesRef = useRef(matches);
  const previewRef = useRef(preview);
  fileRef.current = file;
  matchesRef.current = matches;
  previewRef.current = preview;

  const [commitState, commitAction, commitPending] = useActionState(
    async (previous: CommitState, formData: FormData): Promise<CommitState> => {
      const currentPreview = previewRef.current;
      const currentFile = fileRef.current;

      if (!currentFile || !currentPreview?.ok) {
        return { error: "Choose the CSV file again, then preview it." };
      }

      formData.set("file", currentFile);
      formData.set("accountId", String(currentPreview.accountId));
      formData.set("matches", JSON.stringify(matchesRef.current));
      return confirmImport(previous, formData);
    },
    null,
  );

  useEffect(() => {
    if (!preview?.ok) {
      return;
    }

    const next: Record<string, string> = {};

    for (const row of preview.rows) {
      if (row.duplicate) {
        continue;
      }

      next[row.fingerprint] =
        row.matchedAccountId != null
          ? String(row.matchedAccountId)
          : row.createKey
            ? `new:${row.createKey}`
            : "";
    }

    setMatches(next);
  }, [preview]);

  const defaultAccount = String(
    accounts.find((account) => account.type === "checking")?.id ?? accounts[0]?.id ?? "",
  );
  const onLink = useCallback((id: string, value: string) => {
    setMatches((current) => ({ ...current, [id]: value }));
  }, []);
  const freshRows = preview?.ok ? preview.rows.filter((row) => !row.duplicate) : [];
  const duplicateRows = preview?.ok ? preview.rows.filter((row) => row.duplicate) : [];
  const options = preview?.ok
    ? accounts.filter((account) => account.id !== preview.accountId)
    : [];

  return (
    <div className="stack">
      <form action={previewAction} className="form">
        <label className="field">
          Account
            <select name="accountId" defaultValue={defaultAccount} required>
            {accounts.map((account) => (
              <option key={account.id} value={String(account.id)}>
                {account.name} · {TYPE_LABELS[account.type]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          CSV file
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button className="button" type="submit" disabled={previewPending}>
          {previewPending ? "Reading…" : "Preview"}
        </button>
      </form>

      {preview && !preview.ok ? (
        <p className="alert" role="alert">
          {preview.error}
        </p>
      ) : null}

      {preview?.ok ? (
        <section className="stack">
          <p className="summary">
            {freshRows.length} new · {duplicateRows.length} duplicates ignored ·{" "}
            {preview.skipped.length} not posted
          </p>
          {preview.errors.length > 0 ? (
            <ul className="alert">
              {preview.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
          {commitState?.error ? (
            <p className="alert" role="alert">
              {commitState.error}
            </p>
          ) : null}

          {freshRows.length > 0 ? (
            <form action={commitAction} className="stack">
              <ImportGrid rows={freshRows} matches={matches} options={options} onLink={onLink} />
              <button className="button" type="submit" disabled={commitPending}>
                {commitPending ? "Importing…" : `Import ${freshRows.length} transactions`}
              </button>
            </form>
          ) : (
            <p className="muted">Nothing new to import.</p>
          )}

          <RowDetails title="Duplicates ignored" rows={duplicateRows} />
          {preview.skipped.length > 0 ? (
            <details>
              <summary>Not posted</summary>
              <ul className="plain-list">
                {preview.skipped.map((row) => (
                  <li key={`${row.line}-${row.description}`}>
                    Row {row.line} · {row.description} · {row.status}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function ImportGrid({
  rows,
  matches,
  options,
  onLink,
}: {
  rows: Extract<PreviewState, { ok: true }>["rows"];
  matches: Record<string, string>;
  options: AccountOption[];
  onLink: (id: string, value: string) => void;
}) {
  const gridRows = useMemo<ImportGridRow[]>(
    () =>
      rows.map((row) => ({
        id: row.fingerprint,
        date: formatDate(row.postedOn),
        description: row.classification
          ? `${row.description} · ${row.classification}`
          : row.description,
        amountCents: row.amountCents,
        linkValue:
          row.fingerprint in matches
            ? matches[row.fingerprint]
            : row.matchedAccountId != null
              ? String(row.matchedAccountId)
              : row.createKey
                ? `new:${row.createKey}`
                : "",
        createKey: row.createKey,
        createName: row.createName,
      })),
    [matches, rows],
  );
  const columns = useMemo<ColDef[]>(
    () => [
      { field: "date", headerName: "Date", width: 130, sortable: true },
      { field: "description", headerName: "Description", flex: 1.4, minWidth: 180 },
      {
        field: "amountCents",
        headerName: "Amount",
        width: 120,
        type: "rightAligned",
        cellClass: "num",
        cellClassRules: {
          positive: (params) => Number(params.value) > 0,
          negative: (params) => Number(params.value) < 0,
        },
        valueFormatter: (params) => formatCents(Number(params.value ?? 0)),
      },
      {
        field: "linkValue",
        headerName: "Link to account",
        width: 260,
        sortable: false,
        cellRenderer: (params: ICellRendererParams<ImportGridRow>) => {
          const row = params.data;

          if (!row) {
            return null;
          }

          return (
            <select
              aria-label={`Link ${row.description}`}
              value={row.linkValue}
              onChange={(event) => onLink(row.id, event.target.value)}
            >
              {row.createKey ? (
                <option value={`new:${row.createKey}`}>New: {row.createName}</option>
              ) : null}
              <option value="">No match</option>
              {options.map((account) => (
                <option key={account.id} value={String(account.id)}>
                  {account.name} · {TYPE_LABELS[account.type]}
                </option>
              ))}
            </select>
          );
        },
      },
    ],
    [onLink, options],
  );

  return <AgTable rows={gridRows} columns={columns} />;
}

function RowDetails({
  title,
  rows,
}: {
  title: string;
  rows: Extract<PreviewState, { ok: true }>["rows"];
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <details>
      <summary>
        {title} ({rows.length})
      </summary>
      <ul className="plain-list">
        {rows.map((row) => (
          <li key={row.fingerprint}>
            {formatDate(row.postedOn)} · {row.description} · {formatCents(row.amountCents)}
          </li>
        ))}
      </ul>
    </details>
  );
}
