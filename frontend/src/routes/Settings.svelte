<script>
  import Money from "../components/Money.svelte";
  import { data } from "../lib/data.svelte.js";
  import { formatShortDate, monthOf, todayIso } from "../lib/dates.js";
  import { centsToInput, dollarsToCents } from "../lib/money.js";
  import { buildMonth } from "../lib/month.js";
  import { settings } from "../lib/settings.svelte.js";

  const today = todayIso();
  const month = monthOf(today);

  const model = $derived(
    buildMonth(data.accounts, data.transactions, month, today, { bufferCents: settings.bufferCents }),
  );

  let bufferInput = $state(centsToInput(settings.bufferCents));

  function commitBuffer() {
    const cents = dollarsToCents(bufferInput);
    if (cents === null) {
      bufferInput = centsToInput(settings.bufferCents);
      return;
    }
    settings.setBuffer(cents);
    bufferInput = centsToInput(cents);
  }

  const totalTransfer = $derived(model.transfers.reduce((n, t) => n + t.amountCents, 0));
  const hasLoan = $derived(data.accounts.some((a) => a.type === "loan" && !a.archived));
</script>

<div class="head">
  <h1>Settings</h1>
</div>

<section class="panel">
  <h2>Transfer timing</h2>
  <p class="muted small">
    Smallest loan → checking transfers that keep checking at or above the buffer, each as late as possible
    (less interest, no overdraft fee).
  </p>
  <label class="buffer">
    Keep checking above
    <input
      class="money-input"
      bind:value={bufferInput}
      onblur={commitBuffer}
      onkeydown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  </label>
  {#if model.transfers.length === 0}
    <p class="pos">No transfer needed this month.</p>
  {:else}
    <ul class="plain">
      {#each model.transfers as t (t.date)}
        <li>
          <strong>{formatShortDate(t.date)}</strong>
          move <strong><Money cents={t.amountCents} tint="none" /></strong>{hasLoan ? " from the loan" : ""} to checking
          <span class="muted small">for {t.because.join(", ")}</span>
        </li>
      {/each}
    </ul>
    <p class="muted small">Total to move: <Money cents={totalTransfer} tint="none" /></p>
  {/if}
</section>

<style>
  .head {
    margin-bottom: 14px;
  }

  .small {
    font-size: 12px;
  }

  .panel {
    max-width: 720px;
  }

  .buffer {
    display: flex;
    gap: 8px;
    align-items: center;
    margin: 8px 0;
  }

  .money-input {
    width: 100px;
    text-align: right;
  }

  ul.plain {
    list-style: none;
    padding: 0;
    margin: 8px 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
</style>
