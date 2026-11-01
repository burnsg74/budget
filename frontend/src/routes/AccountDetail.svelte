<script>
  import LineChart from "../components/LineChart.svelte";
  import BarChart from "../components/BarChart.svelte";
  import Money from "../components/Money.svelte";
  import { ACCOUNT_TYPES, TYPE_LABELS, isBalanceType, isLiabilityType } from "../lib/accountTypes.js";
  import { CADENCE_OPTIONS } from "../lib/cadence.js";
  import { balanceOf, balanceSeries } from "../lib/balances.js";
  import { data } from "../lib/data.svelte.js";
  import { addDays, formatDate, formatMonth, monthOf, todayIso } from "../lib/dates.js";
  import { centsToInput, dollarsToCents, formatCents, formatHeldBalance } from "../lib/money.js";
  import { detailGraphKind, monthlyTotals } from "../lib/reports.js";
  import { accountPath, router } from "../lib/router.svelte.js";

  let { name } = $props();

  const today = todayIso();
  const account = $derived(data.accounts.find((a) => a.name === name) ?? null);
  const related = $derived(
    data.transactions
      .filter((t) => t.account === name || t.matched_account === name)
      .sort((a, b) => b.posted_on.localeCompare(a.posted_on) || b.created_at.localeCompare(a.created_at)),
  );
  const balance = $derived(account ? balanceOf(account, data.transactions) : null);
  const graphKind = $derived(account ? detailGraphKind(account) : "monthly");

  const balanceChart = $derived.by(() => {
    if (!account || graphKind !== "balance") return null;
    const series = balanceSeries(account, data.transactions, account.opening_on, today);
    // Daily points are plentiful; the chart only needs to show shape, so thin long ranges.
    const stride = Math.max(1, Math.ceil(series.length / 120));
    const thinned = series.filter((_, i) => i % stride === 0 || i === series.length - 1);
    return {
      labels: thinned.map((p) => formatDate(p.date)),
      values: thinned.map((p) => p.cents),
    };
  });

  const monthly = $derived(account && graphKind === "monthly" ? monthlyTotals(data.transactions, name, monthOf(today), 12) : []);

  // ---- params ---------------------------------------------------------------
  const typeOptions = ACCOUNT_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] ?? value }));
  const cadence = $derived(account?.cadence || "day");

  const fields = $derived.by(() => {
    if (!account) return [];
    const amountLabel =
      cadence === "biweekly" ? "Per paycheck" : cadence === "month" ? "Once a month" : "Expected amount";
    const list = [
      { key: "name", label: "Name", kind: "text" },
      { key: "type", label: "Type", kind: "select", options: typeOptions },
      { key: "match_text", label: "Match text", kind: "text" },
      { key: "institution", label: "Institution", kind: "text", nullable: true },
      { key: "mask", label: "Mask", kind: "text", nullable: true },
      { key: "opening_balance_cents", label: "Opening balance", kind: "money", balance: true },
      { key: "opening_on", label: "Opening date", kind: "date", nullable: true, balance: true },
      { key: "expected_amount_cents", label: amountLabel, kind: "money", nullable: true },
      { key: "cadence", label: "Schedule", kind: "select", options: CADENCE_OPTIONS },
    ];
    if (cadence === "day") list.push({ key: "due_day", label: "Due day", kind: "int", nullable: true });
    if (cadence === "biweekly") list.push({ key: "anchor_on", label: "Anchor date", kind: "date", nullable: true });
    list.push(
      { key: "schedule_active", label: "Scheduled", kind: "bool" },
      { key: "archived", label: "Archived", kind: "bool" },
    );
    return list;
  });

  const visibleFields = $derived(
    fields.filter((field) => !field.balance || (account && isBalanceType(account.type))),
  );
  const tracksBalance = $derived(account ? isBalanceType(account.type) : false);

  let editing = $state(null);
  let draft = $state("");
  let saving = $state(false);

  function display(field, value) {
    if (field.kind === "bool") return value ? "Yes" : "No";
    if (value === null || value === undefined || value === "") return "—";
    if (field.kind === "money") return formatCents(value);
    if (field.kind === "date") return formatDate(value);
    if (field.kind === "select") return field.options.find((option) => option.value === value)?.label ?? value;
    return String(value);
  }

  function start(field) {
    if (!account || saving) return;
    const value = account[field.key];
    if (field.kind === "bool") {
      save(field, !value);
      return;
    }
    draft = field.kind === "money" ? centsToInput(value) : (value ?? "").toString();
    editing = field.key;
  }

  function parse(field, raw) {
    const text = String(raw).trim();
    if (text === "") {
      if (field.nullable) return { value: null };
      if (field.kind === "money") return { value: 0 };
      return { error: `${field.label} is required` };
    }
    if (field.kind === "money") {
      const cents = dollarsToCents(text);
      return cents === null ? { error: "Enter a dollar amount like 123.45" } : { value: cents };
    }
    if (field.kind === "int") {
      const n = Number(text);
      return Number.isInteger(n) ? { value: n } : { error: "Enter a whole number" };
    }
    return { value: text };
  }

  async function save(field, value) {
    if (!account) return;
    if (value === account[field.key]) {
      editing = null;
      return;
    }
    saving = true;
    try {
      await data.updateAccount(account.name, { [field.key]: value });
      editing = null;
      if (field.key === "name") router.navigate(accountPath(value), { replace: true });
    } catch {
      // data.error shows in the banner; leave the editor open so the value can be fixed
    } finally {
      saving = false;
    }
  }

  function commit(field) {
    const result = parse(field, draft);
    if ("error" in result) {
      data.error = result.error;
      return;
    }
    save(field, result.value);
  }

  function cancel() {
    editing = null;
  }

  function onkey(event, field) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit(field);
    } else if (event.key === "Escape") {
      cancel();
    }
  }

  const focus = (el) => {
    el.focus();
    if (el instanceof HTMLInputElement) el.select();
  };
</script>

{#if !account}
  <h1>Account not found</h1>
  <p class="muted">There is no account named "{name}". <a href="/accounts">Back to Accounts</a></p>
{:else}
  <div class="head">
    <h1>{account.name}</h1>
    <span class="tag">{TYPE_LABELS[account.type]}</span>
    {#if account.archived}<span class="tag muted">archived</span>{/if}
    <span class="spacer"></span>
    {#if balance !== null}
      <span class="balance">
        <strong class={{ neg: !isLiabilityType(account.type) && balance < 0 }}>{formatHeldBalance(balance, isLiabilityType(account.type))}</strong>
      </span>
    {/if}
  </div>

  <div class="layout">
    <div class="main">
      <section class="panel">
        <h2>{graphKind === "balance" ? "Balance over time" : "Activity by month"}</h2>
        {#if graphKind === "balance" && balanceChart}
          <LineChart
            labels={balanceChart.labels}
            includeZero={false}
            series={[{ name: "Balance", color: "#2557d6", values: balanceChart.values }]}
          />
        {:else}
          <BarChart
            labels={monthly.map((m) => formatMonth(m.month))}
            series={[{ name: "Total activity", color: "#2557d6", values: monthly.map((m) => m.cents) }]}
          />
        {/if}
      </section>

      <section class="panel">
        <h2>Transactions <span class="muted">({related.length})</span></h2>
        {#if related.length === 0}
          <p class="muted">No transactions reference this account.</p>
        {:else}
          <div class="scroll">
            <table class="simple">
              <thead>
                <tr><th>Date</th><th>Description</th><th>Account</th><th>Matched</th><th class="num">Amount</th></tr>
              </thead>
              <tbody>
                {#each related as t (t.hash)}
                  <tr>
                    <td class="nowrap">{formatDate(t.posted_on)}</td>
                    <td>{t.description}</td>
                    <td>{#if t.account === name}{t.account}{:else}<a href={accountPath(t.account)}>{t.account}</a>{/if}</td>
                    <td>
                      {#if t.matched_account}
                        {#if t.matched_account === name}{t.matched_account}{:else}<a href={accountPath(t.matched_account)}>{t.matched_account}</a>{/if}
                      {/if}
                    </td>
                    <td class="num"><Money cents={t.amount_cents} tint="both" /></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>
    </div>

    <aside class="panel params">
      <h2>Params</h2>
      <p class="muted small">Double-click a value to edit. Enter saves, Esc cancels.</p>
      <dl>
        {#each visibleFields as field (field.key)}
          <dt>{field.label}</dt>
          <dd>
            {#if editing === field.key}
              {#if field.kind === "select"}
                <select
                  value={draft}
                  {@attach focus}
                  onchange={(e) => save(field, e.currentTarget.value)}
                  onblur={cancel}
                  onkeydown={(e) => e.key === "Escape" && cancel()}
                >
                  {#each field.options as option (option.value)}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              {:else}
                <input
                  bind:value={draft}
                  {@attach focus}
                  disabled={saving}
                  onkeydown={(e) => onkey(e, field)}
                  onblur={() => !saving && editing === field.key && commit(field)}
                  placeholder={field.kind === "date" ? "YYYY-MM-DD" : ""}
                />
              {/if}
            {:else}
              <button
                type="button"
                class={["value", { empty: account[field.key] === null || account[field.key] === "" }]}
                title="Double-click to edit"
                ondblclick={() => start(field)}
                onkeydown={(e) => (e.key === "Enter" || e.key === "F2") && start(field)}
              >
                {display(field, account[field.key])}
              </button>
            {/if}
          </dd>
        {/each}
        {#if tracksBalance}
          <dt>Balance</dt>
          <dd><span class="static">{balance === null ? "not tracked" : formatHeldBalance(balance, isLiabilityType(account.type))}</span></dd>
        {/if}
        <dt>Created</dt>
        <dd><span class="static">{account.created_at ? formatDate(account.created_at.slice(0, 10)) : "—"}</span></dd>
      </dl>
    </aside>
  </div>
{/if}

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }

  .spacer {
    flex: 1;
  }

  .balance {
    font-size: 16px;
  }

  .tag {
    font-size: 12px;
    background: var(--accent-soft);
    color: var(--accent);
    padding: 2px 8px;
    border-radius: 10px;
  }

  .tag.muted {
    background: var(--bg);
    color: var(--muted);
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 14px;
    align-items: start;
  }

  @media (max-width: 1000px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .main {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .scroll {
    max-height: 420px;
    overflow: auto;
  }

  .nowrap {
    white-space: nowrap;
  }

  .small {
    font-size: 12px;
    margin: 0 0 8px;
  }

  dl {
    margin: 0;
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 6px 10px;
    align-items: center;
  }

  dt {
    color: var(--muted);
    font-size: 12px;
  }

  dd {
    margin: 0;
    min-width: 0;
  }

  dd input,
  dd select {
    width: 100%;
  }

  .value {
    border: 1px solid transparent;
    background: transparent;
    padding: 4px 6px;
    margin: 0 -6px;
    width: 100%;
    text-align: left;
    border-radius: 4px;
    cursor: default;
    overflow-wrap: anywhere;
  }

  .value:hover {
    background: var(--bg);
    border-color: var(--line);
  }

  .value.empty {
    color: var(--muted);
  }

  .static {
    padding: 4px 0;
    display: inline-block;
  }
</style>
