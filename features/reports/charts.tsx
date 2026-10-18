"use client";

import type { ReactElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCents } from "../../lib/money";

type Point = { label: string; cents: number };
type MonthPoint = { label: string; income: number; expenses: number };

const axisTick = { fill: "var(--muted)", fontSize: 12 };

export function SpendingChart({ points }: { points: Point[] }) {
  return (
    <ChartFrame empty={points.length === 0} emptyLabel="No spending in this range.">
      <LineChart data={points}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="label" tick={axisTick} stroke="var(--line)" minTickGap={24} />
        <YAxis
          tick={axisTick}
          stroke="var(--line)"
          width={84}
          tickFormatter={(value: number) => formatCents(value)}
        />
        <Tooltip formatter={(value) => formatCents(Number(value ?? 0))} />
        <Line
          type="monotone"
          dataKey="cents"
          name="Spending"
          stroke="var(--negative)"
          strokeWidth={2}
          dot={points.length < 2}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartFrame>
  );
}

export function BalanceChart({ points }: { points: Point[] }) {
  return (
    <ChartFrame empty={points.length === 0} emptyLabel="No balance history in this range.">
      <LineChart data={points}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="label" tick={axisTick} stroke="var(--line)" minTickGap={24} />
        <YAxis
          tick={axisTick}
          stroke="var(--line)"
          width={84}
          tickFormatter={(value: number) => formatCents(value)}
        />
        <Tooltip formatter={(value) => formatCents(Number(value ?? 0))} />
        <Line
          type="monotone"
          dataKey="cents"
          name="Balance"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={points.length < 2}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartFrame>
  );
}

export function IncomeExpenseChart({ points }: { points: MonthPoint[] }) {
  const empty = points.every((point) => point.income === 0 && point.expenses === 0);

  return (
    <ChartFrame empty={empty} emptyLabel="No linked income or spending in this range.">
      <BarChart data={points}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="label" tick={axisTick} stroke="var(--line)" />
        <YAxis
          tick={axisTick}
          stroke="var(--line)"
          width={84}
          tickFormatter={(value: number) => formatCents(value)}
        />
        <Tooltip formatter={(value) => formatCents(Number(value ?? 0))} />
        <Bar dataKey="income" name="Income" fill="var(--positive)" isAnimationActive={false} />
        <Bar dataKey="expenses" name="Expenses" fill="var(--negative)" isAnimationActive={false} />
      </BarChart>
    </ChartFrame>
  );
}

function ChartFrame({
  children,
  empty,
  emptyLabel,
}: {
  children: ReactElement;
  empty: boolean;
  emptyLabel: string;
}) {
  if (empty) {
    return <p className="muted">{emptyLabel}</p>;
  }

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={280}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}
