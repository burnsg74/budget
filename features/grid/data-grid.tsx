"use client";

import type { ColDef, ICellRendererParams } from "ag-grid-community";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "../../lib/dates";
import { formatCents } from "../../lib/money";
import type { GridColumn, GridRow } from "./types";

const AgTable = dynamic(() => import("./ag-table").then((mod) => mod.AgTable), {
  ssr: false,
  loading: () => <p className="muted">Loading table…</p>,
});

export function DataGrid({ rows, columns }: { rows: GridRow[]; columns: GridColumn[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return null;
  }

  return (
    <AgTable
      rows={rows}
      columns={columns.map(toColDef)}
      onRowClicked={(row, event) => {
        const target = event.target;
        if (target instanceof Element && target.closest("a, button, select, input")) {
          return;
        }

        if (row.href) {
          router.push(row.href);
        }
      }}
    />
  );
}

function toColDef(column: GridColumn): ColDef<GridRow> {
  const col: ColDef<GridRow> = {
    field: column.field,
    headerName: column.header,
    flex: column.flex,
    width: column.width,
    minWidth: column.minWidth,
    hide: column.hide,
    sort: column.sort,
    sortable: column.kind === "link" ? false : !column.hide,
    type: column.align === "right" ? "rightAligned" : undefined,
  };

  if (column.kind === "money" || column.kind === "moneySigned") {
    col.valueFormatter = (params) =>
      params.value === null || params.value === undefined || params.value === ""
        ? ""
        : formatCents(Number(params.value));
    col.cellClass = "num";
  }

  if (column.kind === "moneySigned") {
    col.cellClassRules = {
      positive: (params) => Number(params.value) > 0,
      negative: (params) => Number(params.value) < 0,
    };
  }

  if (column.kind === "date") {
    col.valueFormatter = (params) => (params.value ? formatDate(String(params.value)) : "");
  }

  if (column.kind === "link") {
    col.cellRenderer = LinkCell;
    col.cellRendererParams = { label: column.linkLabel ?? "Edit" };
  }

  return col;
}

function LinkCell(params: ICellRendererParams<GridRow> & { label?: string }) {
  const href = params.data?.href;

  if (!href) {
    return null;
  }

  return (
    <Link href={href} className="grid-link">
      {params.label ?? "Edit"}
    </Link>
  );
}

export type { GridColumn, GridRow };
