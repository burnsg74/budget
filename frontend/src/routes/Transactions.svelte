<script>
  import Grid from "../components/Grid.svelte";
  import { data } from "../lib/data.svelte.js";
  import { todayIso } from "../lib/dates.js";
  import { accountLinkColumn, moneyColumn } from "../lib/gridColumns.js";

  let gridApi = $state(null);
  let quickFilter = $state("");
  let selected = $state(null);
  let importing = $state(false);
  let importSummary = $state(null);

  const names = $derived(data.accounts.map((a) => a.name).sort((a, b) => a.localeCompare(b)));

  const columnDefs = $derived([
    accountLinkColumn((row) => row.matched_account ?? row.account),
    { field: "posted_on", headerName: "Posted", width: 120, sort: "desc", sortIndex: 0 },
    {
      field: "matched_account",
      headerName: "Matched account",
      flex: 1,
      minWidth: 200,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: ["", ...names] },
      valueParser: (p) => (p.newValue === "" ? null : p.newValue),
    },
    moneyColumn("amount_cents", "Amount", { width: 120 }),
    { field: "status", headerName: "Status", width: 100 },
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
        gridApi.startEditingCell({ rowIndex: node.rowIndex, colKey: "matched_account" });
      }, 60);
    } catch {
      // surfaced by the app banner
    }
  }

  async function onImportFile(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    importing = true;
    importSummary = null;
    try {
      importSummary = await data.importCsv(await file.text());
    } catch {
      // surfaced by the app banner
    } finally {
      importing = false;
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
  <label class="file">
    {importing ? "Importing…" : "Import CSV"}
    <input type="file" accept=".csv,text/csv" hidden disabled={importing} onchange={onImportFile} />
  </label>
  <button onclick={addRow}>Add row</button>
  <button class="danger" onclick={removeSelected} disabled={!selected}>Delete row</button>
</div>

{#if importSummary}
  <p class="summary">
    Added {importSummary.added}, skipped {importSummary.skipped} duplicate{importSummary.skipped === 1 ? "" : "s"}
    {#if importSummary.accountsCreated.length}
      , created {importSummary.accountsCreated.length} account{importSummary.accountsCreated.length === 1 ? "" : "s"}: {importSummary.accountsCreated.join(", ")}
    {/if}.
    <button class="link" onclick={() => (importSummary = null)}>Dismiss</button>
  </p>
{/if}

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
  with Matched account.
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

  label.file {
    border: 1px solid var(--line);
    background: var(--panel);
    border-radius: 6px;
    padding: 5px 12px;
    cursor: pointer;
  }

  label.file:hover {
    border-color: var(--accent);
  }

  .hint,
  .summary {
    font-size: 12px;
  }

  .summary {
    margin: 0 0 10px;
  }

  button.link {
    border: 0;
    background: none;
    padding: 0;
    color: var(--accent);
    text-decoration: underline;
  }
</style>
