"use client";

import { useEffect, useRef, useState } from "react";
import { fetchRevenue } from "@/lib/api";
import type { MonthlyRevenue } from "@/types";
import { BarChart3, Loader2 } from "lucide-react";

interface RevenueChartProps {
  className?: string;
}

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

const CHART_HEIGHT = 140;
const BAR_GAP = 4;

export function RevenueChart({ className }: RevenueChartProps) {
  const [monthly, setMonthly] = useState<MonthlyRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRevenue(12, 10)
      .then((result) => {
        if (!cancelled) {
          setMonthly(result.monthly);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load revenue");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-card px-4 py-3 text-sm text-text-muted ${className ?? ""}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading revenue chart...
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-xl border border-border bg-surface-card px-4 py-3 text-sm text-red-400 ${className ?? ""}`}>
        {error}
      </div>
    );
  }

  const sorted = [...monthly].sort((a, b) => a.month.localeCompare(b.month));
  const maxTotal = Math.max(...sorted.map((m) => m.total), 1);
  const barWidth = Math.max(8, (width - 40 - sorted.length * BAR_GAP) / sorted.length);
  const svgWidth = Math.max(width - 32, 0);

  return (
    <div ref={containerRef} className={`rounded-xl border border-border bg-surface-card ${className ?? ""}`}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <BarChart3 className="h-4 w-4 text-revenue" />
        <span className="text-xs font-semibold text-text-primary">Revenue Trend</span>
      </div>

      {sorted.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-text-muted">
          No revenue data yet.
        </div>
      ) : (
        <div className="overflow-x-auto px-4 pb-3 pt-4">
          <svg
            width={svgWidth}
            height={CHART_HEIGHT}
            className="overflow-visible"
            role="img"
            aria-label="Monthly revenue bar chart"
          >
            {sorted.map((m, i) => {
              const x = i * (barWidth + BAR_GAP);
              const barH = (m.total / maxTotal) * (CHART_HEIGHT - 24);
              return (
                <g key={m.month}>
                  <rect
                    x={x}
                    y={CHART_HEIGHT - 20 - barH}
                    width={barWidth}
                    height={Math.max(barH, 1)}
                    rx={3}
                    fill="url(#revenue-gradient)"
                    className="hover:opacity-80 transition-opacity"
                  />
                  {m.total > 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={CHART_HEIGHT - 24 - barH}
                      textAnchor="middle"
                      className="fill-text-muted"
                      style={{ fontSize: "9px", fontFamily: "inherit" }}
                    >
                      {m.total >= 1000
                        ? `$${(m.total / 1000).toFixed(m.total >= 10000 ? 0 : 1)}k`
                        : `$${m.total}`}
                    </text>
                  )}
                  <text
                    x={x + barWidth / 2}
                    y={CHART_HEIGHT - 4}
                    textAnchor="middle"
                    className="fill-text-muted"
                    style={{ fontSize: "8px", fontFamily: "inherit" }}
                  >
                    {formatMonth(m.month)}
                  </text>
                </g>
              );
            })}
            <defs>
              <linearGradient id="revenue-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.3} />
              </linearGradient>
            </defs>
          </svg>
        </div>
      )}
    </div>
  );
}
