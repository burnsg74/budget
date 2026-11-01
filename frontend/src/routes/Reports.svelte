<script>
  import BarChart from "../components/BarChart.svelte";
  import LineChart from "../components/LineChart.svelte";
  import Money from "../components/Money.svelte";
  import { isLiabilityType, isOverdraftAccount } from "../lib/accountTypes.js";
  import { data } from "../lib/data.svelte.js";
  import { formatMonth, isIsoDate, monthOf, monthRange, todayIso } from "../lib/dates.js";
  import { formatCents, formatHeldBalance } from "../lib/money.js";
  import {
    defaultRange,
    incomeExpenseByMonth,
    jobSearchFloor,
    liabilityBalancesByMonth,
    spendingSeries,
    typicalSpending,
  } from "../lib/reports.js";
  import { accountPath } from "../lib/router.svelte.js";
  import { settings } from "../lib/settings.svelte.js";

  const today = todayIso();
  // Last 12 months, but not earlier than the first transaction (avoids a wall of empty months).
  const earliest = data.transactions.reduce((min, t) => (t.posted_on < min ? t.posted_on : min), today);
  const initial = (() => {
    const base = defaultRange(today);
    return { from: earliest > base.from ? `${earliest.slice(0, 7)}-01` : base.from, to: base.to };
  })();
  let from = $state(initial.from);
  let to = $state(initial.to);

  const range = $derived.by(() => {
    if (!isIsoDate(from) || !isIsoDate(to)) return initial;
    return from <= to ? { from, to } : { from: to, to: from };
  });

  const incomeRows = $derived(incomeExpenseByMonth(data.accounts, data.transactions, range.from, range.to));
  const liabilities = $derived(liabilityBalancesByMonth(data.accounts, data.transactions, range.from, range.to));

  // ---- job-search floor -------------------------------------------------------
  const byName = (a, b) => a.name.localeCompare(b.name);
  const incomeAccounts = $derived(
    data.accounts.filter((a) => a.type === "income" && !a.archived && !isOverdraftAccount(a)).sort(byName),
  );
  const myIncome = $derived(settings.resolveMyIncome(data.accounts));
  const typical = $derived(typicalSpending(data.accounts, data.transactions, today, 3));
  const floor = $derived(
    jobSearchFloor(data.accounts, myIncome, {
      extraSpendingCents: settings.floorIncludesSpending ? typical : 0,
    }),
  );

  function toggleMine(name, checked) {
    const next = new Set(myIncome);
    if (checked) next.add(name);
    else next.delete(name);
    settings.setMyIncome([...next]);
  }

  // ---- optional spending series ---------------------------------------------
  let spendingAccount = $state("");
  const spendableAccounts = $derived(
    data.accounts
      .filter((a) => (a.type === "checking" || a.type === "bill" || a.type === "household" || a.type === "other") && !isOverdraftAccount(a))
      .sort(byName),
  );
  const spendingMonthly = $derived.by(() => {
    if (!spendingAccount) return null;
    const daily = spendingSeries(data.accounts, data.transactions, spendingAccount, range.from, range.to);
    const byMonth = new Map(monthRange(monthOf(range.from), monthOf(range.to)).map((m) => [m, 0]));
    for (const d of daily) byMonth.set(monthOf(d.date), (byMonth.get(monthOf(d.date)) ?? 0) + d.cents);
    return [...byMonth.entries()].map(([month, cents]) => ({ month, cents }));
  });
</script>

<div class="head">
  <h1>Reports</h1>
  <span class="spacer"></span>
  <label>From <input type="date" bind:value={from} /></label>
  <label>To <input type="date" bind:value={to} /></label>
</div>

<section class="panel floor">
  <h2>Job-search floor</h2>
  <p class="muted small">
    Minimum monthly income needed to cover bills and required debt payments without the other earners.
  </p>
  <div class="floor-grid">
    <div class="big">
      <span class="label">Income the job must cover</span>
      <span class="value"><Money cents={floor.floorCents} tint="none" /></span>
      <span class="muted small">per month</span>
    </div>
    <div class="big">
      <span class="label">My expected income</span>
      <span class="value"><Money cents={floor.mineCents} tint="none" /></span>
      <span class="small">
        {#if floor.shortfallCents > 0}
          <span class="neg">short by {formatCents(floor.shortfallCents)}</span>
        {:else}
          <span class="pos">covers it with {formatCents(floor.surplusCents)} to spare</span>
        {/if}
      </span>
    </div>
    <table class="simple breakdown">
      <tbody>
        <tr><td>Bills ({floor.bills.length})</td><td class="num"><Money cents={floor.billsCents} tint="none" /></td></tr>
        <tr><td>Required debt payments ({floor.debt.length})</td><td class="num"><Money cents={floor.debtCents} tint="none" /></td></tr>
        {#if settings.floorIncludesSpending}
          <tr><td>Typical household & other (3 mo. avg)</td><td class="num"><Money cents={floor.extraSpendingCents} tint="none" /></td></tr>
        {/if}
        <tr><td><strong>Total required</strong></td><td class="num"><strong><Money cents={floor.requiredCents} tint="none" /></strong></td></tr>
        <tr><td class="muted">Other earners' expected income</td><td class="num muted"><Money cents={floor.othersCents} tint="none" /></td></tr>
      </tbody>
    </table>
  </div>
  <div class="mine">
    <span class="label">Counts as "my" income:</span>
    {#each incomeAccounts as a (a.name)}
      <label class="check">
        <input type="checkbox" checked={myIncome.includes(a.name)} onchange={(e) => toggleMine(a.name, e.currentTarget.checked)} />
        {a.name}
      </label>
    {/each}
    <label class="check extra">
      <input
        type="checkbox"
        checked={settings.floorIncludesSpending}
        onchange={(e) => settings.setFloorIncludesSpending(e.currentTarget.checked)}
      />
      Include typical household/other spending ({formatCents(typical)}/mo)
    </label>
  </div>
</section>

<section class="panel">
  <h2>Income vs expenses by month</h2>
  <BarChart
    labels={incomeRows.map((r) => formatMonth(r.month))}
    series={[
      { name: "Income", color: "#137a3d", values: incomeRows.map((r) => r.incomeCents) },
      { name: "Expenses (bills, household, other)", color: "#b42318", values: incomeRows.map((r) => r.expenseCents) },
      { name: "Debt payments (cards, loans)", color: "#9a6700", values: incomeRows.map((r) => r.debtCents) },
    ]}
  />
  <div class="scroll">
    <table class="simple">
      <thead>
        <tr>
          <th>Month</th><th class="num">Income</th><th class="num">Expenses</th><th class="num">Debt payments</th><th class="num">Net</th>
        </tr>
      </thead>
      <tbody>
        {#each incomeRows as r (r.month)}
          <tr>
            <td>{formatMonth(r.month)}</td>
            <td class="num"><Money cents={r.incomeCents} tint="none" /></td>
            <td class="num"><Money cents={r.expenseCents} tint="none" /></td>
            <td class="num"><Money cents={r.debtCents} tint="none" /></td>
            <td class="num"><Money cents={r.netCents} tint="both" /></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="muted small">
    Only transactions matched to an account are counted. Debt payments are shown apart from expenses.
  </p>
</section>

<section class="panel">
  <h2>Loan and credit card balances by month-end</h2>
  {#if liabilities.accounts.length === 0}
    <p class="muted">No loan or credit card accounts.</p>
  {:else}
    <div class="scroll">
      <table class="simple">
        <thead>
          <tr>
            <th>Account</th>
            {#each liabilities.months as m (m)}<th class="num">{formatMonth(m)}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each liabilities.accounts as a (a.name)}
            <tr>
              <td><a href={accountPath(a.name)}>{a.name}</a></td>
              {#each a.points as p (p.month)}
                <td class="num">{p.cents === null ? "—" : formatHeldBalance(p.cents, isLiabilityType(a.type)).replace(" owed", "")}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="muted small">Amounts are what is owed at month-end (the current month is as of today).</p>
    <div class="mini-charts">
      {#each liabilities.accounts as a (a.name)}
        <div>
          <h2>{a.name}</h2>
          <LineChart
            height={170}
            includeZero={false}
            labels={a.points.map((p) => formatMonth(p.month))}
            series={[{ name: "Balance", color: "#2557d6", values: a.points.map((p) => p.cents) }]}
          />
        </div>
      {/each}
    </div>
  {/if}
</section>

<section class="panel">
  <h2>Spending for one account</h2>
  <label>
    Account
    <select bind:value={spendingAccount}>
      <option value="">Choose…</option>
      {#each spendableAccounts as a (a.name)}
        <option value={a.name}>{a.name}</option>
      {/each}
    </select>
  </label>
  {#if spendingMonthly}
    <BarChart
      labels={spendingMonthly.map((m) => formatMonth(m.month))}
      series={[{ name: "Spending", color: "#2557d6", values: spendingMonthly.map((m) => m.cents) }]}
    />
  {:else}
    <p class="muted small">Pick an account to see its spending over the selected range.</p>
  {/if}
</section>

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
  }

  .spacer {
    flex: 1;
  }

  section {
    margin-bottom: 14px;
  }

  .small {
    font-size: 12px;
  }

  .scroll {
    overflow-x: auto;
    margin-top: 10px;
  }

  .floor-grid {
    display: grid;
    grid-template-columns: 220px 220px minmax(260px, 1fr);
    gap: 24px;
    align-items: start;
  }

  @media (max-width: 900px) {
    .floor-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .big {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .label {
    font-size: 12px;
    color: var(--muted);
  }

  .value {
    font-size: 26px;
    font-weight: 700;
  }

  .mine {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    align-items: center;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }

  .check {
    display: flex;
    gap: 5px;
    align-items: center;
  }

  .mini-charts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 18px;
    margin-top: 12px;
  }
</style>
