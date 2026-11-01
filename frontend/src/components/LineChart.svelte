<script>
  import { formatCents } from "../lib/money.js";

  // labels: category labels (shared x axis). series: [{ name, color, values: (number|null)[] }] in cents.
  let { labels, series, height = 240, tickEvery = null, includeZero = true } = $props();

  const W = 760;
  const PAD = { top: 12, right: 14, bottom: 26, left: 62 };

  const all = $derived(series.flatMap((s) => s.values).filter((v) => v !== null && v !== undefined));
  const floor = $derived(includeZero ? 0 : Infinity);
  const ceil = $derived(includeZero ? 0 : -Infinity);
  const dataMin = $derived(all.length ? Math.min(floor, ...all) : 0);
  const dataMax = $derived(all.length ? Math.max(ceil, ...all) : 1);
  // Pad flat series so a constant balance still draws a visible line.
  const rawMin = $derived(dataMin === dataMax ? dataMin - 100 : dataMin);
  const rawMax = $derived(dataMin === dataMax ? dataMax + 100 : dataMax);
  const span = $derived(rawMax - rawMin || 1);

  const plotW = W - PAD.left - PAD.right;
  const plotH = $derived(height - PAD.top - PAD.bottom);

  const x = (i) => PAD.left + (labels.length <= 1 ? plotW / 2 : (i / (labels.length - 1)) * plotW);
  const y = (v) => PAD.top + plotH - ((v - rawMin) / span) * plotH;

  const ticks = $derived(Array.from({ length: 5 }, (_, i) => rawMin + (span * i) / 4));
  const step = $derived(tickEvery ?? Math.max(1, Math.ceil(labels.length / 8)));

  function pathFor(values) {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null || v === undefined) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  }

  let hover = $state(null);

  function onmove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const ratio = (px - PAD.left) / plotW;
    hover = Math.max(0, Math.min(labels.length - 1, Math.round(ratio * (labels.length - 1))));
  }
</script>

{#if labels.length === 0 || all.length === 0}
  <p class="muted">No data to chart.</p>
{:else}
  <div class="chart">
    <svg viewBox="0 0 {W} {height}" role="img" aria-label="Line chart" onpointermove={onmove} onpointerleave={() => (hover = null)}>
      {#each ticks as t (t)}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} class="grid" />
        <text x={PAD.left - 6} y={y(t) + 4} text-anchor="end" class="tick">{formatCents(Math.round(t / 100) * 100).replace(".00", "")}</text>
      {/each}
      {#if rawMin < 0 && rawMax > 0}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} class="zero" />
      {/if}
      {#each labels as label, i (i)}
        {#if i % step === 0}
          <text x={x(i)} y={height - 8} text-anchor="middle" class="tick">{label}</text>
        {/if}
      {/each}
      {#each series as s (s.name)}
        <path d={pathFor(s.values)} fill="none" stroke={s.color} stroke-width="2" stroke-linejoin="round" />
      {/each}
      {#if hover !== null}
        <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} class="cross" />
        {#each series as s (s.name)}
          {#if s.values[hover] !== null && s.values[hover] !== undefined}
            <circle cx={x(hover)} cy={y(s.values[hover])} r="3.5" fill={s.color} />
          {/if}
        {/each}
      {/if}
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
  .chart {
    width: 100%;
  }

  svg {
    width: 100%;
    max-width: 960px;
    height: auto;
    display: block;
  }

  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }

  .zero {
    stroke: var(--muted);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  .cross {
    stroke: var(--muted);
    stroke-width: 1;
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
