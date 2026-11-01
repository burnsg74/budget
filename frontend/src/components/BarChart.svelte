<script>
  import { formatCents } from "../lib/money.js";

  // labels: categories. series: [{ name, color, values: number[] }] in cents (grouped bars).
  let { labels, series, height = 240 } = $props();

  const W = 760;
  const PAD = { top: 12, right: 14, bottom: 26, left: 62 };

  const all = $derived(series.flatMap((s) => s.values));
  const rawMin = $derived(all.length ? Math.min(0, ...all) : 0);
  const rawMax = $derived(all.length ? Math.max(0, ...all) : 1);
  const span = $derived(rawMax - rawMin || 1);

  const plotW = W - PAD.left - PAD.right;
  const plotH = $derived(height - PAD.top - PAD.bottom);
  const groupW = $derived(plotW / Math.max(labels.length, 1));
  const barW = $derived(Math.min(28, (groupW * 0.8) / Math.max(series.length, 1)));

  const y = (v) => PAD.top + plotH - ((v - rawMin) / span) * plotH;
  const ticks = $derived(Array.from({ length: 5 }, (_, i) => rawMin + (span * i) / 4));

  let hover = $state(null);
</script>

{#if labels.length === 0 || all.every((v) => v === 0)}
  <p class="muted">No data to chart.</p>
{:else}
  <div class="chart">
    <svg viewBox="0 0 {W} {height}" role="img" aria-label="Bar chart" onpointerleave={() => (hover = null)}>
      {#each ticks as t (t)}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} class="grid" />
        <text x={PAD.left - 6} y={y(t) + 4} text-anchor="end" class="tick">{formatCents(Math.round(t / 100) * 100).replace(".00", "")}</text>
      {/each}
      {#each labels as label, i (i)}
        {@const gx = PAD.left + i * groupW + (groupW - barW * series.length) / 2}
        <rect
          x={PAD.left + i * groupW}
          y={PAD.top}
          width={groupW}
          height={plotH}
          fill="transparent"
          onpointerenter={() => (hover = i)}
          role="presentation"
        />
        {#each series as s, si (s.name)}
          {@const v = s.values[i]}
          <rect
            x={gx + si * barW}
            y={Math.min(y(v), y(0))}
            width={Math.max(barW - 2, 1)}
            height={Math.max(Math.abs(y(v) - y(0)), v === 0 ? 0 : 1)}
            fill={s.color}
            opacity={hover === null || hover === i ? 1 : 0.55}
            pointer-events="none"
          />
        {/each}
        <text x={PAD.left + i * groupW + groupW / 2} y={height - 8} text-anchor="middle" class="tick">{label}</text>
      {/each}
      <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} class="zero" />
    </svg>
    <div class="legend">
      {#if hover !== null}
        <strong>{labels[hover]}</strong>
        {#each series as s (s.name)}
          <span><i style:background={s.color}></i>{s.name}: {formatCents(s.values[hover])}</span>
        {/each}
      {:else}
        {#each series as s (s.name)}
          <span><i style:background={s.color}></i>{s.name}</span>
        {/each}
      {/if}
    </div>
  </div>
{/if}

<style>
  svg {
    width: 100%;
    max-width: 960px;
    height: auto;
    display: block;
  }

  .grid {
    stroke: var(--line);
  }

  .zero {
    stroke: var(--muted);
  }

  .tick {
    font-size: 10px;
    fill: var(--muted);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    font-size: 12px;
    min-height: 18px;
    margin-top: 4px;
  }

  .legend i {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 2px;
    margin-right: 5px;
  }
</style>
