import { formatCurrency } from "@/lib/utils";
import type { ContactProfile } from "@/types";
import { DollarSign, Minus, TrendingDown, TrendingUp } from "lucide-react";

interface RevenueSectionProps {
  profile: ContactProfile;
}

export function RevenueSection({ profile }: RevenueSectionProps) {
  const TrendIcon =
    profile.revenueTrend === "up"
      ? TrendingUp
      : profile.revenueTrend === "down"
        ? TrendingDown
        : Minus;

  const trendColor =
    profile.revenueTrend === "up"
      ? "text-emerald-400"
      : profile.revenueTrend === "down"
        ? "text-rose-400"
        : "text-text-muted";

  const trendLabel =
    profile.revenueTrend === "up"
      ? "+18% this month"
      : profile.revenueTrend === "down"
        ? "-5% this month"
        : "No change this month";

  const progress = Math.min(100, (profile.revenue / 2500) * 100);

  return (
    <section className="border-b border-border px-5 py-5">
      <div className="mb-3 flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-revenue" />
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
          Lifetime revenue
        </h3>
      </div>
      <div className="rounded-2xl border border-border bg-surface-card p-4 shadow-card">
        <p className="text-3xl font-bold tracking-tight text-revenue">
          {formatCurrency(profile.revenue)}
        </p>
        <div className={`mt-2 flex items-center gap-1.5 text-xs ${trendColor}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          <span>{trendLabel}</span>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-gradient-to-r from-revenue-muted to-revenue shadow-glow-green"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2.5 text-[11px] text-text-muted">
          {progress >= 100 ? "Top tier fan" : `${Math.round(progress)}% to whale tier`}
        </p>
      </div>
    </section>
  );
}
