<script>
  // Thin wrapper over AG Grid Community's vanilla API.
  // Rows are plain objects; the parent owns the data and reacts to edits.
  import { untrack } from "svelte";
  import { AllCommunityModule, ModuleRegistry, createGrid } from "ag-grid-community";

  ModuleRegistry.registerModules([AllCommunityModule]);

  let {
    columnDefs,
    rowData,
    getRowId,
    onedit,
    api = $bindable(null),
    quickFilter = "",
    onselect,
    height = "calc(100vh - 190px)",
  } = $props();

  function grid(element) {
    const gridApi = createGrid(element, {
      columnDefs: untrack(() => columnDefs),
      rowData: untrack(() => rowData),
      getRowId: (params) => getRowId(params.data),
      defaultColDef: {
        sortable: true,
        filter: true,
        resizable: true,
        editable: true,
        minWidth: 70,
      },
      rowSelection: { mode: "singleRow", checkboxes: false, enableClickSelection: true },
      singleClickEdit: false,
      stopEditingWhenCellsLoseFocus: true,
      enterNavigatesVertically: true,
      enterNavigatesVerticallyAfterEdit: true,
      animateRows: false,
      onCellValueChanged: (event) => {
        if (event.oldValue === event.newValue) return;
        onedit?.({
          data: event.data,
          field: event.colDef.field,
          oldValue: event.oldValue,
          newValue: event.newValue,
        });
      },
      onSelectionChanged: () => onselect?.(gridApi.getSelectedRows()[0] ?? null),
    });
    api = gridApi;
    return () => {
      gridApi.destroy();
      api = null;
    };
  }

  $effect(() => {
    api?.setGridOption("rowData", rowData);
  });

  $effect(() => {
    api?.setGridOption("columnDefs", columnDefs);
  });

  $effect(() => {
    api?.setGridOption("quickFilterText", quickFilter);
  });
</script>

<div class="grid" style:height {@attach grid}></div>

<style>
  .grid {
    width: 100%;
    min-height: 300px;
  }
</style>
