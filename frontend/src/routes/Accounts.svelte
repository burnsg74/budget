<script>
  import Grid from "../components/Grid.svelte";
  import { ACCOUNT_TYPES } from "../lib/accountTypes.js";
  import { balancesByName } from "../lib/balances.js";
  import { data } from "../lib/data.svelte.js";
  import {
    accountLinkColumn,
    checkboxColumn,
    moneyColumn,
    nullableInt,
    nullableText,
  } from "../lib/gridColumns.js";

  let gridApi = $state(null);
  let quickFilter = $state("");
  let selected = $state(null);
  let showArchived = $state(true);

  const balances = $derived(balancesByName(data.accounts, data.transactions));
  const rows = $derived(
    data.accounts
      .filter((a) => showArchived || !a.archived)
      .map((a) => ({ ...a, balance_cents: balances.get(a.name) ?? null })),
  );

  const columnDefs = [
    accountLinkColumn((row) => row.name),
    { field: "name", headerName: "Name", flex: 2, minWidth: 180, sort: "asc" },
    {
      field: "type",
      headerName: "Type",
      width: 130,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: ACCOUNT_TYPES },
    },
    moneyColumn("balance_cents", "Balance", { editable: false, width: 130 }),
    nullableText("opening_on", "Opening on", { width: 120 }),
    moneyColumn("expected_amount_cents", "Expected", { nullable: true, width: 120 }),
    nullableInt("due_day", "Due day", { width: 90 }),
    checkboxColumn("schedule_active", "Scheduled"),
    checkboxColumn("archived", "Archived"),
    { field: "created_at", headerName: "Created", editable: false, hide: true, width: 190 },
  ];

  async function onedit({ data: row, field, newValue }) {
    try {
      await data.updateAccount(row.name, { [field]: newValue });
    } catch {
      // data.error is shown in the app banner; the reload restores the old value
    }
  }

  async function addRow() {
    let n = 1;
    const names = new Set(data.accounts.map((a) => a.name));
    while (names.has(`New account ${n}`)) n++;
    const name = `New account ${n}`;
    try {
      await data.createAccount({ name, type: "other" });
      // Wait for the grid to receive the reloaded rows, then start editing the new name.
      setTimeout(() => {
        const node = gridApi?.getRowNode(name);
        if (!node) return;
        gridApi.ensureNodeVisible(node, "middle");
        node.setSelected(true);
        gridApi.startEditingCell({ rowIndex: node.rowIndex, colKey: "name" });
      }, 60);
    } catch {
      // surfaced by the app banner
    }
  }

  async function removeSelected() {
    if (!selected) return;
    if (!confirm(`Delete account "${selected.name}"? Accounts used by transactions cannot be deleted; archive them instead.`)) {
      return;
    }
    try {
      await data.deleteAccount(selected.name);
      selected = null;
    } catch {
      // surfaced by the app banner
    }
  }
</script>

<div class="head">
  <h1>Accounts</h1>
  <span class="muted">{rows.length} accounts</span>
  <span class="spacer"></span>
  <input type="search" placeholder="Filter all columns…" bind:value={quickFilter} />
  <label class="check"><input type="checkbox" bind:checked={showArchived} /> Archived</label>
  <button onclick={addRow}>Add row</button>
  <button class="danger" onclick={removeSelected} disabled={!selected}>Delete row</button>
</div>

<Grid
  {columnDefs}
  rowData={rows}
  getRowId={(row) => row.name}
  {onedit}
  bind:api={gridApi}
  {quickFilter}
  onselect={(row) => (selected = row)}
/>
<p class="hint muted">
  Double-click a cell to edit. Name is the unique key; renaming updates every transaction that references it.
  Dates are YYYY-MM-DD. Balance is derived (opening balance plus posted transactions) and read-only.
</p>

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .spacer {
    flex: 1;
  }

  .check {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .hint {
    font-size: 12px;
  }
</style>
