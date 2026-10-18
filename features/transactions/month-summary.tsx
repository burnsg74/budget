"use client";

import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatCents } from "../../lib/money";

type Slice = { label: string; cents: number };

const COLORS: Record<string, string> = {
  Income: "#1f8a4c",
  Bills: "#3b6fd8",
  Household: "#7c4ddb",
  "Credit Cards": "#e07a2f",
  Loans: "#d23b3b",
  Unspecified: "#9a918a",
};

export function MonthSummary({
  owedCents,
  liabilities,
  incomeCents,
  expenses,
}: {
  owedCents: number;
  liabilities: { id: number; name: string; owedCents: number }[];
  incomeCents: number;
  expenses: Slice[];
}) {
  const income = incomeCents > 0 ? [{ label: "Income", cents: incomeCents }] : [];

  return (
    <aside className="side">
      <section className="panel">
        <div className="side-head">
          <h2>Borrowed</h2>
          <strong className="money">{formatCents(owedCents)}</strong>
        </div>
        {liabilities.length === 0 ? (
          <p className="muted">No cards or loans.</p>
        ) : (
          <ul className="plain-list">
            {liabilities.map((item) => (
              <li key={item.id} className="line">
                <Link href={`/accounts/${item.id}`}>{item.name}</Link>
                <span className="money">{formatCents(item.owedCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel donuts">
        <Donut title="Income" slices={income} empty="No income this month." />
        <Donut title="Expenses" slices={expenses} empty="No expenses this month." />
      </section>
    </aside>
  );
}

function Donut({ title, slices, empty }: { title: string; slices: Slice[]; empty: string }) {
  const total = slices.reduce((sum, slice) => sum + slice.cents, 0);

  return (
    <div className="donut">
      <h2>{title}</h2>
      {total <= 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <>
          <div className="donut-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="cents"
                  nameKey="label"
                  innerRadius={46}
                  outerRadius={64}
                  paddingAngle={slices.length > 1 ? 1 : 0}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {slices.map((slice) => (
                    <Cell key={slice.label} fill={COLORS[slice.label] ?? "#9a918a"} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <strong>{formatCents(total)}</strong>
              <span>Total</span>
            </div>
          </div>
          <ul className="legend">
            {slices.map((slice) => (
              <li key={slice.label}>
                <i style={{ background: COLORS[slice.label] ?? "#9a918a" }} />
                <span>{slice.label}</span>
                <span>
                  {formatPercent(slice.cents, total)} {formatCents(slice.cents)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function formatPercent(part: number, total: number): string {
  const pct = (part / total) * 100;
  const rounded = pct >= 10 || Number.isInteger(pct) ? Math.round(pct) : Math.round(pct * 10) / 10;
  return `${rounded}%`;
}
