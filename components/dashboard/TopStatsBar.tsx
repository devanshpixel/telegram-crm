import { formatCurrency } from "@/lib/utils";
import type { DashboardStats } from "@/types";
import { BarChart3, MessageCircle, Radio, Wallet } from "lucide-react";

interface TopStatsBarProps {
  stats: DashboardStats;
  onOpenAnalytics?: () => void;
}

export function TopStatsBar({ stats, onOpenAnalytics }: TopStatsBarProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-black px-4 py-3 sm:px-5 lg:px-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-muted shadow-glow">
          <span className="text-sm font-bold text-white">L</span>
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight sm:text-base">
            Lustify CRM
          </h1>
          <p className="hidden text-[11px] text-text-muted xs:block">
            Telegram inbox
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <StatPill
          icon={<MessageCircle className="h-3.5 w-3.5" />}
          label="Chats"
          value={String(stats.totalChats)}
        />
        <StatPill
          icon={<Radio className="h-3.5 w-3.5 text-emerald-400" />}
          label="Online"
          value={String(stats.onlineCount)}
          highlight
        />
        <StatPill
          icon={<Wallet className="h-3.5 w-3.5 text-revenue" />}
          label="Revenue"
          value={formatCurrency(stats.totalRevenue, true)}
          highlight
          className="hidden sm:flex"
        />
        {onOpenAnalytics && (
          <button
            type="button"
            onClick={onOpenAnalytics}
            aria-label="Open analytics"
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-card px-2.5 py-1.5 text-text-secondary hover:bg-surface-hover sm:px-3 sm:py-2"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden text-xs font-medium sm:inline">Analytics</span>
          </button>
        )}
      </div>
    </header>
  );
}

function StatPill({
  icon,
  label,
  value,
  highlight,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border border-border bg-surface-card px-2.5 py-1.5 sm:px-3 sm:py-2 ${className ?? ""}`}
    >
      {icon}
      <div className="min-w-0">
        <p className="text-[9px] font-medium uppercase tracking-wider text-text-muted sm:text-[10px]">
          {label}
        </p>
        <p
          className={`text-xs font-semibold tabular-nums sm:text-sm ${highlight ? "text-text-primary" : "text-text-secondary"}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
