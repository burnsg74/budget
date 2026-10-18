"use client";

import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type RowStyle } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

ModuleRegistry.registerModules([AllCommunityModule]);

const compact = {
  fontSize: 13,
  headerFontSize: 11,
  headerFontWeight: 600,
  spacing: 5,
  rowHeight: 32,
  headerHeight: 32,
  borderRadius: 6,
  wrapperBorderRadius: 8,
};

export const gridTheme = themeQuartz
  .withParams(
    {
      ...compact,
      backgroundColor: "#fffcf8",
      foregroundColor: "#1c1917",
      borderColor: "#e7e5e4",
      headerBackgroundColor: "#fffcf8",
      headerTextColor: "#57534e",
      rowHoverColor: "#f3f1ee",
      accentColor: "#1f4d3a",
      browserColorScheme: "light",
    },
    "light",
  )
  .withParams(
    {
      ...compact,
      backgroundColor: "#292524",
      foregroundColor: "#fafaf9",
      borderColor: "#44403c",
      headerBackgroundColor: "#292524",
      headerTextColor: "#a8a29e",
      rowHoverColor: "#3a342f",
      accentColor: "#d6d3d1",
      browserColorScheme: "dark",
    },
    "dark",
  );

type GridRecord = { id: string | number; href?: string; estimated?: boolean };

export function AgTable({
  rows,
  columns,
  onRowClicked,
}: {
  rows: GridRecord[];
  columns: ColDef[];
  onRowClicked?: (row: GridRecord, event: Event) => void;
}) {
  return (
    <div className="grid-host">
      <AgGridReact<GridRecord>
        theme={gridTheme}
        rowData={rows}
        columnDefs={columns}
        domLayout="autoHeight"
        getRowId={(params) => String(params.data.id)}
        headerHeight={32}
        rowHeight={32}
        animateRows={false}
        suppressMovableColumns
        defaultColDef={{
          sortable: true,
          resizable: true,
          suppressHeaderMenuButton: true,
        }}
        getRowStyle={(params) => {
          const style: RowStyle = {
            cursor: params.data?.href ? "pointer" : "default",
          };

          if (params.data?.estimated) {
            style.fontStyle = "italic";
          }

          return style;
        }}
        onRowClicked={
          onRowClicked
            ? (event) => {
                if (event.data && event.event) {
                  onRowClicked(event.data, event.event);
                }
              }
            : undefined
        }
      />
    </div>
  );
}
