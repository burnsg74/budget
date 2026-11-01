<script>
  import { formatCents } from "../lib/money.js";

  // `color`: tint negatives red (and positives green when `tint` is "both").
  let { cents, tint = "negative" } = $props();
</script>

{#if cents === null || cents === undefined}
  <span class="muted">—</span>
{:else}
  <span class={["num", { neg: cents < 0 && tint !== "none", pos: cents > 0 && tint === "both" }]}>
    {formatCents(cents)}
  </span>
{/if}
