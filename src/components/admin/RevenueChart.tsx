"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function RevenueChart({ data }: { data: Array<{ date: string; valor: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b07885" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#b07885" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={28}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={70}
          tickFormatter={(v: number) =>
            v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
          }
        />
        <Tooltip
          formatter={(value: number | string) => [
            Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
            "Faturamento",
          ]}
          contentStyle={{ borderRadius: 12, border: "1px solid #e4e4e7", fontSize: 13 }}
        />
        <Area
          type="monotone"
          dataKey="valor"
          stroke="#b07885"
          strokeWidth={2}
          fill="url(#revGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
