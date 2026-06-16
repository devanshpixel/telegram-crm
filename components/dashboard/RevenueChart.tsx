"use client";

import { useEffect, useRef, useState } from "react";
import { fetchRevenue } from "@/lib/api";
import type { MonthlyRevenue } from "@/types";
import { BarChart3 } from "lucide-react";

interface RevenueChartProps {
  className?: string;
}

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

const CHART_HEIGHT = 120;
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

  if (loading) return null;

  if (error) return null;

  const sorted = [...monthly].filter(m => m.total > 0).sort((a, b) => a.month.localeCompare(b.month));
  
  if (sorted.length === 0) {
    return (
      <div className={`flex items-center justify-center rounded-xl border border-border bg-surface-card px-4 py-6 text-xs text-text-muted ${className ?? ""}`}>
        No revenue trend data
      </div>
    );
  }

  const maxTotal = Math.max(...sorted.map((m) => m.total), 1);
  const barWidth = Math.max(8, (width - 40 - sorted.length * BAR_GAP) / sorted.length);
  const svgWidth = Math.max(width - 32, 0);

  return (
    <div ref={containerRef} className={`rounded-xl border border-border bg-surface-card ${className ?? ""}`}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <BarChart3 className="h-3.5 w-3.5 text-revenue" />
        <span className="text-[10px] font-semibold text-text-primary uppercase tracking-wider">Revenue Trend</span>
      </div>

      <div className="overflow-x-auto px-4 pb-2 pt-3">
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
                  rx={2}
                  fill="url(#revenue-gradient)"
                  className="hover:opacity-80 transition-opacity"
                />
                {m.total > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={CHART_HEIGHT - 24 - barH}
                    textAnchor="middle"
                    className="fill-text-muted"
                    style={{ fontSize: "8px", fontFamily: "inherit" }}
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
                  style={{ fontSize: "7px", fontFamily: "inherit" }}
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
    </div>
  );
}

