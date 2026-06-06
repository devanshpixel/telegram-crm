"use client";

import { useEffect, useState } from "react";
import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { fetchAnalytics } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { AnalyticsData } from "@/types";
import { FollowUpSection } from "./FollowUpSection";

interface AnalyticsModalProps {
  open: boolean;
  onClose: () => void;
  onSelectContact?: (contactId: string) => void;
}

export function AnalyticsModal({ open, onClose, onSelectContact }: AnalyticsModalProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    fetchAnalytics()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative flex h-full max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-panel">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-base font-semibold">Analytics</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
          {loading && (
            <p className="text-center text-sm text-text-muted">Loading...</p>
          )}
          {error && <p className="text-center text-sm text-rose-400">{error}</p>}
          {data && (
            <div className="space-y-6">
              <Section title="Overview">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Total fans" value={String(data.overview.totalFans)} />
                  <Stat label="Active" value={String(data.overview.activeFans)} accent="violet" />
                  <Stat label="VIP" value={String(data.overview.vipFans)} accent="violet" />
                  <Stat
                    label="Revenue"
                    value={formatCurrency(data.overview.totalRevenue, true)}
                    accent="revenue"
                  />
                  <Stat
                    label="Last 30d"
                    value={formatCurrency(data.overview.revenueLast30Days, true)}
                    accent="revenue"
                  />
                  <Stat label="Sent" value={String(data.overview.messagesSent)} />
                  <Stat label="Received" value={String(data.overview.messagesReceived)} />
                  <Stat
                    label="Growth"
                    value={`${data.overview.revenueGrowthPercent > 0 ? "+" : ""}${data.overview.revenueGrowthPercent}%`}
                    icon={
                      data.overview.revenueGrowthPercent > 0 ? (
                        <TrendingUp className="h-3 w-3 text-emerald-400" />
                      ) : data.overview.revenueGrowthPercent < 0 ? (
                        <TrendingDown className="h-3 w-3 text-rose-400" />
                      ) : (
                        <Minus className="h-3 w-3 text-text-muted" />
                      )
                    }
                  />
                </div>
              </Section>

              <FollowUpSection onSelectContact={onSelectContact} />

              <Section title="Fans by VIP level">
                <BreakdownList
                  items={data.fansByVipLevel.map((v) => ({
                    label: v.level,
                    value: v.count,
                  }))}
                />
              </Section>

              <Section title="Fans by status">
                <BreakdownList
                  items={data.fansByStatus.map((s) => ({
                    label: s.status,
                    value: s.count,
                  }))}
                />
              </Section>

              <Section title="Fan scores">
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Highest" value={String(data.fanScores.highest)} />
                  <Stat label="Average" value={String(data.fanScores.average)} />
                </div>
              </Section>

              <Section title="Most active contacts">
                {data.mostActive.length === 0 ? (
                  <p className="text-xs text-text-muted">No data.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.mostActive.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between rounded-lg bg-surface-card px-3 py-2 text-sm"
                      >
                        <span className="truncate">{c.name}</span>
                        <span className="text-xs text-text-muted">
                          {c.messageCount} msgs
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title={`Inactive (30+ days)`}>
                {data.inactiveContacts.length === 0 ? (
                  <p className="text-xs text-text-muted">No inactive fans.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.inactiveContacts.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between rounded-lg bg-surface-card px-3 py-2 text-sm"
                      >
                        <span className="truncate">{c.name}</span>
                        <span className="text-xs text-rose-400">
                          {c.daysSinceActivity}d
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Recent purchasers">
                {data.recentPurchasers.length === 0 ? (
                  <p className="text-xs text-text-muted">No purchases yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.recentPurchasers.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between rounded-lg bg-surface-card px-3 py-2 text-sm"
                      >
                        <span className="truncate">{c.name}</span>
                        <span className="text-xs text-revenue">
                          {formatCurrency(c.totalSpent, true)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-muted">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: "violet" | "revenue";
  icon?: React.ReactNode;
}) {
  const valueClass =
    accent === "revenue"
      ? "text-revenue"
      : accent === "violet"
        ? "text-violet-400"
        : "text-text-primary";
  return (
    <div className="rounded-lg bg-surface-card px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className={`mt-0.5 flex items-center gap-1 text-sm font-semibold tabular-nums ${valueClass}`}>
        {icon}
        {value}
      </p>
    </div>
  );
}

function BreakdownList({
  items,
}: {
  items: { label: string; value: number }[];
}) {
  if (items.length === 0) {
    return <p className="text-xs text-text-muted">No data.</p>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-3 text-sm">
          <span className="w-20 shrink-0 capitalize text-text-secondary">
            {item.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-card">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right text-xs tabular-nums text-text-muted">
            {item.value}
          </span>
        </li>
      ))}
    </ul>
  );
}
