"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { TYPE_LABELS, type AccountType } from "../../lib/account-types";
import { formatDate } from "../../lib/dates";
import { formatCents } from "../../lib/money";
import {
  confirmImport,
  previewImport,
  type CommitState,
  type PreviewState,
} from "./actions";

type AccountOption = {
  id: string;
  name: string;
  type: AccountType;
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
      formData.set("accountId", currentPreview.accountId);
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
      if (!row.duplicate) {
        next[row.fingerprint] = row.matchedAccountId ?? "";
      }
    }

    setMatches(next);
  }, [preview]);

  const defaultAccount =
    accounts.find((account) => account.type === "checking")?.id ?? accounts[0]?.id ?? "";
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
              <option key={account.id} value={account.id}>
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
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th className="num">Amount</th>
                      <th>Link to account</th>
                    </tr>
                  </thead>
                  <tbody>
                    {freshRows.map((row) => (
                      <tr key={row.fingerprint}>
                        <td>{formatDate(row.postedOn)}</td>
                        <td>
                          {row.description}
                          {row.classification ? (
                            <span className="sub">{row.classification}</span>
                          ) : null}
                        </td>
                        <td className={row.amountCents < 0 ? "num negative" : "num positive"}>
                          {formatCents(row.amountCents)}
                        </td>
                        <td>
                          <select
                            aria-label={`Link ${row.description}`}
                            value={
                              row.fingerprint in matches
                                ? matches[row.fingerprint]
                                : (row.matchedAccountId ?? "")
                            }
                            onChange={(event) =>
                              setMatches((current) => ({
                                ...current,
                                [row.fingerprint]: event.target.value,
                              }))
                            }
                          >
                            <option value="">No match</option>
                            {options.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.name} · {TYPE_LABELS[account.type]}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
