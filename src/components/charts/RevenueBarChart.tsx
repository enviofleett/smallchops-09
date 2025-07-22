
import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Receives dynamic data/revenue trends.
 * If no data, shows fallback info.
 */
const defaultData = [
  { day: "Mon", revenue: 22000 },
  { day: "Tue", revenue: 28500 },
  { day: "Wed", revenue: 19000 },
  { day: "Thu", revenue: 31500 },
  { day: "Fri", revenue: 44000 },
  { day: "Sat", revenue: 28000 },
  { day: "Sun", revenue: 8500 },
];

const RevenueBarChart = ({ data, isLoading }: { data?: { day: string; revenue: number }[]; isLoading?: boolean }) => {
  const chartData = data && Array.isArray(data) && data.length > 0 ? data : defaultData;

  if (isLoading) {
    return <div className="h-64 pt-2"><Skeleton className="w-full h-full rounded" /></div>;
  }

  return (
    <div className="h-64 pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barSize={32}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0f2f1" />
          <XAxis
            dataKey="day"
            stroke="#38b2ac"
            fontSize={13}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="#a0aec0"
            fontSize={13}
            tickFormatter={(value) => `₦${value / 1000}k`}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
            }}
            formatter={(value: number) => [`₦${value.toLocaleString()}`, "Revenue"]}
          />
          <Bar
            dataKey="revenue"
            fill="url(#barGradientTeal)"
            radius={[6, 6, 0, 0]}
          />
          <defs>
            <linearGradient id="barGradientTeal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2dd4bf" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RevenueBarChart;
