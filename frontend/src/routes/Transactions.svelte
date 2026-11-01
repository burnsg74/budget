<script>
  import Grid from "../components/Grid.svelte";
  import { data } from "../lib/data.svelte.js";
  import { todayIso } from "../lib/dates.js";
  import { accountLinkColumn, moneyColumn, nullableText } from "../lib/gridColumns.js";

  let gridApi = $state(null);
  let quickFilter = $state("");
  let selected = $state(null);

  const names = $derived(data.accounts.map((a) => a.name).sort((a, b) => a.localeCompare(b)));

  const columnDefs = $derived([
    accountLinkColumn((row) => row.matched_account ?? row.account),
    { field: "posted_on", headerName: "Posted", width: 120, sort: "desc", sortIndex: 0 },
    {
      field: "account",
      headerName: "Account",
      width: 190,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: names },
    },
    {
      field: "matched_account",
      headerName: "Matched account",
      flex: 1,
      minWidth: 200,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: ["", ...names] },
      valueParser: (p) => (p.newValue === "" ? null : p.newValue),
    },
    { field: "description", headerName: "Description", flex: 2, minWidth: 220 },
    moneyColumn("amount_cents", "Amount", { width: 120 }),
    nullableText("check_number", "Check #", { width: 90 }),
    { field: "status", headerName: "Status", width: 100 },
    nullableText("classification", "Classification", { width: 150 }),
    {
      field: "hash",
      headerName: "Hash",
      width: 110,
      editable: false,
      valueFormatter: (p) => (p.value ? `${p.value.slice(0, 10)}…` : ""),
      tooltipValueGetter: (p) => p.value,
    },
    { field: "created_at", headerName: "Created", editable: false, hide: true, width: 190 },
  ]);

  async function onedit({ data: row, field, newValue }) {
    try {
      await data.updateTransaction(row.hash, { [field]: newValue });
    } catch {
      // data.error is shown in the app banner; the reload restores the old value
    }
  }

  async function addRow() {
    const checking = data.accounts.find((a) => a.type === "checking" && !a.archived) ?? data.accounts[0];
    if (!checking) return;
    try {
      const tx = await data.createTransaction({
        account: checking.name,
        posted_on: todayIso(),
        description: "New transaction",
        amount_cents: 0,
        status: "Posted",
      });
      setTimeout(() => {
        const node = gridApi?.getRowNode(tx.hash);
        if (!node) return;
        gridApi.ensureNodeVisible(node, "middle");
        node.setSelected(true);
        gridApi.startEditingCell({ rowIndex: node.rowIndex, colKey: "description" });
      }, 60);
    } catch {
      // surfaced by the app banner
    }
  }

  async function removeSelected() {
    if (!selected) return;
    if (!confirm(`Delete "${selected.description}" (${selected.posted_on})?`)) return;
    try {
      await data.deleteTransaction(selected.hash);
      selected = null;
    } catch {
      // surfaced by the app banner
    }
  }
</script>

<div class="head">
  <h1>Transactions</h1>
  <span class="muted">{data.transactions.length} rows</span>
  <span class="spacer"></span>
  <input type="search" placeholder="Filter all columns…" bind:value={quickFilter} />
  <button onclick={addRow}>Add row</button>
  <button class="danger" onclick={removeSelected} disabled={!selected}>Delete row</button>
</div>

<Grid
  {columnDefs}
  rowData={data.transactions}
  getRowId={(row) => row.hash}
  {onedit}
  bind:api={gridApi}
  {quickFilter}
  onselect={(row) => (selected = row)}
/>
<p class="hint muted">
  Double-click a cell to edit. Amounts are signed (negative leaves the account). Link a row to an account
  with Matched account. Hash is the row's permanent identity and is read-only.
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

  .hint {
    font-size: 12px;
  }
</style>
