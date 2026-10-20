"use client";

import Link from "next/link";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCents } from "../../lib/money";
import type { AccountMonthPoint } from "../../lib/reports";
import type { LiabilityItem } from "../../lib/register";

type Slice = { label: string; cents: number };

const COLORS: Record<string, string> = {
  Income: "#1f8a4c",
  Bills: "#3b6fd8",
  Household: "#7c4ddb",
  "Credit Cards": "#e07a2f",
  Loans: "#d23b3b",
  Unspecified: "#9a918a",
};

const axisTick = { fill: "var(--muted)", fontSize: 11 };

export function MonthSummary({
  liabilities,
  incomeCents,
  expenses,
  accountChart,
}: {
  liabilities: LiabilityItem[];
  incomeCents: number;
  expenses: Slice[];
  accountChart: { name: string; points: AccountMonthPoint[]; clearHref: string } | null;
}) {
  const income = incomeCents > 0 ? [{ label: "Income", cents: incomeCents }] : [];

  return (
    <aside className="side">
      {liabilities.length > 0 ? (
        <section className="panel borrowed">
          <h2>Borrowed</h2>
          <ul className="plain-list">
            {liabilities.map((item) => (
              <li key={item.id} className="line">
                <Link href={`/accounts/${item.id}`}>{item.name}</Link>
                <span className="money">{formatCents(item.owedCents)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="panel donuts">
        <Donut title="Income" slices={income} empty="No income this month." />
        <Donut title="Expenses" slices={expenses} empty="No expenses this month." />
      </section>
      {accountChart ? (
        <section className="panel account-year">
          <div className="side-head">
            <div>
              <h2>{accountChart.name}</h2>
              <p>Monthly total, past year</p>
            </div>
            <Link href={accountChart.clearHref}>Clear</Link>
          </div>
          <div className="chart-compact">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={accountChart.points}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} stroke="var(--line)" minTickGap={16} />
                <YAxis
                  tick={axisTick}
                  stroke="var(--line)"
                  width={48}
                  tickFormatter={(value: number) => formatAxis(value)}
                />
                <Tooltip
                  formatter={(value) => formatCents(Number(value ?? 0))}
                  labelFormatter={(_, payload) => {
                    const point = payload?.[0]?.payload as AccountMonthPoint | undefined;
                    return point?.title ?? "";
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="cents"
                  name="Total"
                  stroke="#3b6fd8"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}
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

function formatAxis(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
