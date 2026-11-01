// Column-definition helpers shared by the Accounts and Transactions grids.
import { formatCents, dollarsToCents } from "./money.js";
import { accountPath } from "./router.svelte.js";

const right = { type: "rightAligned", cellClass: "num-cell" };

/** Cents column: shows dollars, edits as a dollar string, stores integer cents. */
export function moneyColumn(field, headerName, extra = {}) {
  return {
    field,
    headerName,
    ...right,
    filter: "agNumberColumnFilter",
    filterValueGetter: (p) => (p.data[field] === null || p.data[field] === undefined ? null : p.data[field] / 100),
    valueFormatter: (p) => formatCents(p.value),
    valueParser: (p) => {
      const raw = String(p.newValue ?? "").trim();
      if (raw === "") return extra.nullable ? null : 0;
      const cents = dollarsToCents(raw);
      return cents === null ? p.oldValue : cents;
    },
    cellEditorParams: { useFormatter: true },
    cellClassRules: { neg: (p) => typeof p.value === "number" && p.value < 0 },
    ...extra,
  };
}

/** Nullable text: empty string -> null. */
export function nullableText(field, headerName, extra = {}) {
  return {
    field,
    headerName,
    valueParser: (p) => {
      const v = String(p.newValue ?? "").trim();
      return v === "" ? null : v;
    },
    ...extra,
  };
}

/** Nullable integer (e.g. due_day). */
export function nullableInt(field, headerName, extra = {}) {
  return {
    field,
    headerName,
    ...right,
    filter: "agNumberColumnFilter",
    valueParser: (p) => {
      const v = String(p.newValue ?? "").trim();
      if (v === "") return null;
      const n = Number(v);
      return Number.isInteger(n) ? n : p.oldValue;
    },
    ...extra,
  };
}

export function checkboxColumn(field, headerName, extra = {}) {
  return {
    field,
    headerName,
    cellRenderer: "agCheckboxCellRenderer",
    cellEditor: "agCheckboxCellEditor",
    width: 100,
    ...extra,
  };
}

/** Narrow column with a link to the account detail page. */
export function accountLinkColumn(nameOf) {
  return {
    headerName: "",
    colId: "open",
    width: 64,
    editable: false,
    sortable: false,
    filter: false,
    resizable: false,
    cellRenderer: (p) => {
      const name = nameOf(p.data);
      if (!name) return "";
      const a = document.createElement("a");
      a.href = accountPath(name);
      a.textContent = "Open";
      return a;
    },
  };
}
