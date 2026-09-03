"use client";
import { motion } from "framer-motion";
import { cn, formatNumber, getDeltaColor, getDeltaSign } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

interface MetricCardProps {
  title: string;
  value: number | string;
  delta?: number;
  deltaLabel?: string;
  format?: "number" | "percent" | "position" | "raw";
  sparklineData?: number[];
  sparklineColor?: string;
  icon?: React.ReactNode;
  suffix?: string;
  prefix?: string;
  delay?: number;
  className?: string;
  invertDelta?: boolean; // for position — lower is better
}

export function MetricCard({
  title,
  value,
  delta,
  deltaLabel = "vs last period",
  format = "number",
  sparklineData,
  sparklineColor = "var(--color-accent-600)",
  icon,
  suffix,
  prefix,
  delay = 0,
  className,
  invertDelta = false,
}: MetricCardProps) {
  const displayValue =
    format === "number" && typeof value === "number"
      ? formatNumber(value)
      : format === "percent"
      ? `${value}%`
      : format === "position"
      ? `#${value}`
      : String(value);

  const effectiveDelta = invertDelta && delta !== undefined ? -delta : delta;
  const isPositive = effectiveDelta !== undefined && effectiveDelta > 0;
  const isNegative = effectiveDelta !== undefined && effectiveDelta < 0;
  const deltaColor = effectiveDelta === undefined ? "" : isPositive ? "text-emerald-400" : isNegative ? "text-red-400" : "text-slate-400";
  const sparkData = sparklineData?.map((v, i) => ({ i, v })) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={cn(
        "card p-6 flex flex-col gap-5 group cursor-default hover:shadow-card-hover relative overflow-hidden",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {icon && (
            <div className="p-2 rounded-[10px] bg-blue-500/10 text-blue-600">
              {icon}
            </div>
          )}
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            {title}
          </span>
        </div>
        {effectiveDelta !== undefined && (
          <span className={cn("flex items-center gap-0.5 text-xs font-medium", deltaColor)}>
            {isPositive ? <TrendingUp size={12} /> : isNegative ? <TrendingDown size={12} /> : <Minus size={12} />}
            {getDeltaSign(effectiveDelta)}{Math.abs(effectiveDelta)}%
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            {prefix}{displayValue}{suffix}
          </div>
          {effectiveDelta !== undefined && (
            <div className="text-xs text-[var(--text-muted)] mt-0.5">{deltaLabel}</div>
          )}
        </div>

        {sparkData.length > 0 && (
          <div className="w-24 h-10 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <Line
                  type="natural"
                  dataKey="v"
                  stroke={sparklineColor}
                  strokeWidth={2}
                  dot={false}
                  strokeLinecap="round"
                />
                <Tooltip
                  contentStyle={{ display: "none" }}
                  cursor={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  );
}
