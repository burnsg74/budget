<script>
  import Money from "../components/Money.svelte";
  import { data } from "../lib/data.svelte.js";
  import { formatDate, formatMonthLong, formatShortDate, monthOf, todayIso } from "../lib/dates.js";
  import { formatHeldBalance } from "../lib/money.js";
  import { buildMonth } from "../lib/month.js";
  import { accountPath } from "../lib/router.svelte.js";
  import { settings } from "../lib/settings.svelte.js";

  const today = todayIso();
  const month = monthOf(today);

  const model = $derived(
    buildMonth(data.accounts, data.transactions, month, today, { bufferCents: settings.bufferCents }),
  );

  const nextIncome = $derived(model.upcoming.find((u) => u.direction === "in"));
</script>

<div class="head">
  <h1>{formatMonthLong(month)}</h1>
  <span class="muted">Today is {formatDate(today)} · {model.txCount} posted transactions this month</span>
</div>

{#if model.goesNegative}
  <div class="alert bad" role="alert">
    Checking is projected to go <strong>negative</strong>: low point
    <strong><Money cents={model.low.balanceCents} /></strong> on {formatDate(model.low.date)}{#if model.low.name}
      (after {model.low.name}){/if}.
  </div>
{:else if model.gap.gapCents < 0}
  <div class="alert warn" role="status">
    Checking stays above $0, but this month's income is short of expenses by
    <strong><Money cents={-model.gap.gapCents} tint="none" /></strong>.
  </div>
{/if}

<section class="cards">
  <div class="panel stat">
    <span class="label">Checking now</span>
    <span class="value"><Money cents={model.cashNowCents} /></span>
  </div>
  <div class="panel stat">
    <span class="label">Projected end of month</span>
    <span class="value"><Money cents={model.endCents} /></span>
  </div>
  <div class="panel stat">
    <span class="label">Lowest point</span>
    <span class="value"><Money cents={model.low.balanceCents} /></span>
    <span class="muted small">{formatShortDate(model.low.date)}{model.low.name ? ` · ${model.low.name}` : " · today"}</span>
  </div>
  <div class="panel stat">
    <span class="label">Month gap (income − outflow)</span>
    <span class="value"><Money cents={model.gap.gapCents} tint="both" /></span>
    <span class="muted small">
      <Money cents={model.gap.incomeCents} tint="none" /> in · <Money cents={model.gap.outflowCents} tint="none" /> out
    </span>
  </div>
  <div class="panel stat">
    <span class="label">Next income</span>
    {#if nextIncome}
      <span class="value"><Money cents={nextIncome.amountCents} tint="none" /></span>
      <span class="muted small">{nextIncome.name} · {formatShortDate(nextIncome.dueOn)}</span>
    {:else}
      <span class="muted small">none expected</span>
    {/if}
  </div>
</section>

<div class="cols">
  <div class="stack">
    {#each model.sections as section (section.type)}
      <section class="panel">
        <div class="section-head">
          <h2>{section.label}</h2>
          <span class="num">
            <Money cents={section.totalCents} tint="none" />
            {#if section.expectedCents > 0}
              <span class="muted small">(<Money cents={section.expectedCents} tint="none" /> still expected)</span>
            {/if}
          </span>
        </div>
        {#if section.items.length === 0}
          <p class="muted small">Nothing this month.</p>
        {:else}
          <table class="simple">
            <thead>
              <tr><th>Account</th><th class="num">Posted</th><th class="num">Expected</th></tr>
            </thead>
            <tbody>
              {#each section.items as item (item.name)}
                <tr>
                  <td><a href={accountPath(item.name)}>{item.name}</a> <span class="muted small">×{item.count}</span></td>
                  <td class="num"><Money cents={item.postedCents} tint="none" /></td>
                  <td class="num">
                    {#if item.expectedCents}<Money cents={item.expectedCents} tint="none" />{:else}<span class="muted">—</span>{/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </section>
    {/each}
  </div>

  <div class="stack">
    <section class="panel">
      <h2>Tracked balances</h2>
      <table class="simple">
        <thead>
          <tr><th>Account</th><th class="num">Now</th><th class="num">End of month</th></tr>
        </thead>
        <tbody>
          <tr class="group"><td colspan="3">Checking</td></tr>
          {#each model.balances.checking as a (a.name)}
            <tr>
              <td><a href={accountPath(a.name)}>{a.name}</a></td>
              <td class="num"><Money cents={a.balanceCents} /></td>
              <td class="num"><Money cents={model.endCents} /></td>
            </tr>
          {/each}
          <tr class="group"><td colspan="3">Loans</td></tr>
          {#each model.balances.loans as a (a.name)}
            <tr>
              <td><a href={accountPath(a.name)}>{a.name}</a></td>
              <td class="num">{formatHeldBalance(a.balanceCents, true)}</td>
              <td class="num">{formatHeldBalance(a.endOfMonthCents, true)}</td>
            </tr>
          {/each}
          <tr class="group"><td colspan="3">Credit Cards</td></tr>
          {#each model.balances.cards as a (a.name)}
            <tr>
              <td><a href={accountPath(a.name)}>{a.name}</a></td>
              <td class="num">{formatHeldBalance(a.balanceCents, true)}</td>
              <td class="num">{formatHeldBalance(a.endOfMonthCents, true)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>

    <section class="panel">
      <h2>Upcoming this month</h2>
      {#if model.timeline.length === 0}
        <p class="muted">Nothing left to pay or receive this month.</p>
      {:else}
        <table class="simple">
          <thead>
            <tr><th>Date</th><th>Item</th><th class="num">Amount</th><th class="num">Checking after</th></tr>
          </thead>
          <tbody>
            {#each model.timeline as row (row.name + row.date)}
              <tr class={{ low: row.date === model.low.date && row.balance === model.low.balanceCents }}>
                <td>
                  {formatShortDate(row.date)}
                  {#if row.pastDue}<span class="tag">past due</span>{/if}
                </td>
                <td><a href={accountPath(row.name)}>{row.name}</a></td>
                <td class="num"><Money cents={row.delta} tint="both" /></td>
                <td class="num"><Money cents={row.balance} /></td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>

    <section class="panel">
      <h2>Loan & transfer activity</h2>
      {#if model.loanTransfers.length === 0}
        <p class="muted">No loan or transfer transactions this month.</p>
      {:else}
        <table class="simple">
          <thead>
            <tr><th>Date</th><th>Description</th><th>Account</th><th class="num">Amount</th></tr>
          </thead>
          <tbody>
            {#each model.loanTransfers as t (t.hash)}
              <tr>
                <td>{formatShortDate(t.date)}</td>
                <td>{t.description}</td>
                <td>{#if t.counterparty}<a href={accountPath(t.counterparty)}>{t.counterparty}</a>{/if}</td>
                <td class="num"><Money cents={t.amountCents} tint="both" /></td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>

    {#if model.unmatched.count > 0}
      <section class="panel">
        <h2>Unmatched</h2>
        <p class="muted small">
          {model.unmatched.count} transactions this month have no matched account:
          <Money cents={model.unmatched.inCents} tint="none" /> in, <Money cents={model.unmatched.outCents} tint="none" /> out.
          <a href="/transactions">Match them</a>.
        </p>
      </section>
    {/if}
  </div>
</div>

<style>
  .head {
    display: flex;
    align-items: baseline;
    gap: 14px;
    margin-bottom: 14px;
  }

  .small {
    font-size: 12px;
  }

  .alert {
    padding: 10px 14px;
    border-radius: var(--radius);
    margin-bottom: 14px;
  }

  .alert.bad {
    background: var(--bad-soft);
    color: var(--bad);
  }

  .alert.warn {
    background: var(--warn-soft);
    color: var(--warn);
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 12px;
    margin-bottom: 14px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .label {
    font-size: 12px;
    color: var(--muted);
  }

  .value {
    font-size: 22px;
    font-weight: 600;
  }

  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 14px;
    align-items: start;
  }

  @media (max-width: 1000px) {
    .cols {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  tr.group td {
    font-weight: 600;
    font-size: 12px;
    color: var(--muted);
    background: var(--bg);
  }

  tr.low td {
    background: var(--warn-soft);
  }

  .tag {
    font-size: 11px;
    color: var(--warn);
    background: var(--warn-soft);
    border-radius: 4px;
    padding: 0 5px;
  }
</style>
