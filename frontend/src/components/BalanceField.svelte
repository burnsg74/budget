<script>
  import { centsToInput, dollarsToCents, formatCents } from "../lib/money.js";

  let { cents, onsave, size = "inline", tint = "negative", resting = null } = $props();

  let editing = $state(false);
  let draft = $state("");
  let saving = $state(false);
  let error = $state("");

  const focus = (el) => {
    el.focus();
    if (el instanceof HTMLInputElement) el.select();
  };

  function start() {
    if (saving) return;
    draft = centsToInput(cents);
    error = "";
    editing = true;
  }

  function cancel() {
    if (saving) return;
    editing = false;
    error = "";
  }

  async function commit() {
    if (!editing || saving) return;
    const target = dollarsToCents(draft);
    if (target === null) {
      error = "Enter a dollar amount like 123.45";
      return;
    }
    if (target === cents) {
      editing = false;
      error = "";
      return;
    }
    saving = true;
    error = "";
    try {
      await onsave(target);
      editing = false;
    } catch {
      // data.error is shown in the app banner
    } finally {
      saving = false;
    }
  }

  function onkey(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }
</script>

<span class={["field", size]}>
  {#if editing}
    <input
      bind:value={draft}
      {@attach focus}
      disabled={saving}
      inputmode="decimal"
      aria-label="Balance"
      onkeydown={onkey}
      onblur={() => commit()}
    />
  {:else}
    <button type="button" class={["amount", { neg: cents < 0 && tint !== "none", pos: cents > 0 && tint === "both" }]} title="Click to set the balance" onclick={start}>
      {resting ?? formatCents(cents)}
    </button>
  {/if}
  <span class="hint">Setting this moves the whole history by the same amount.</span>
  {#if error}<span class="error">{error}</span>{/if}
</span>

<style>
  .field {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-width: 0;
  }

  .amount {
    border: 1px solid transparent;
    background: transparent;
    padding: 0 4px;
    margin: 0 -4px;
    text-align: left;
    border-radius: 4px;
    font-weight: 600;
  }

  .amount:hover {
    background: var(--bg);
    border-color: var(--line);
  }

  .stat .amount,
  .stat input {
    font-size: 22px;
    font-weight: 600;
  }

  .inline .amount {
    font-size: inherit;
    font-weight: inherit;
  }

  input {
    width: 9em;
    max-width: 100%;
  }

  .hint,
  .error {
    font-size: 12px;
    font-weight: 400;
    line-height: 1.3;
  }

  .hint {
    color: var(--muted);
  }

  .error {
    color: var(--bad);
  }
</style>
