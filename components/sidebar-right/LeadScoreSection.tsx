import { cn } from "@/lib/utils";
import type { ContactProfile } from "@/types";
import { Flame, Snowflake, Sun, Zap } from "lucide-react";

interface LeadScoreSectionProps {
  profile: ContactProfile;
}

const statusConfig = {
  hot: {
    icon: Flame,
    label: "Hot lead",
    color: "text-rose-400",
    ring: "stroke-rose-400",
    bg: "bg-rose-500/10 ring-rose-500/20",
  },
  warm: {
    icon: Sun,
    label: "Warm lead",
    color: "text-amber-400",
    ring: "stroke-amber-400",
    bg: "bg-amber-500/10 ring-amber-500/20",
  },
  cold: {
    icon: Snowflake,
    label: "Cold lead",
    color: "text-cyan-400",
    ring: "stroke-cyan-400",
    bg: "bg-cyan-500/10 ring-cyan-500/20",
  },
};

export function LeadScoreSection({ profile }: LeadScoreSectionProps) {
  const config = statusConfig[profile.leadStatus];
  const StatusIcon = config.icon;
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (profile.leadScore / 100) * circumference;

  return (
    <section className="px-5 py-5 pb-8">
      <div className="mb-4 flex items-center gap-2">
        <Zap className="h-4 w-4 text-accent" />
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
          Lead score
        </h3>
      </div>

      <div className="flex items-center gap-5 rounded-2xl border border-border bg-surface-card p-4">
        <div className="relative h-[88px] w-[88px] shrink-0">
          <svg className="h-[88px] w-[88px] -rotate-90" viewBox="0 0 88 88">
            <circle
              cx="44"
              cy="44"
              r="36"
              fill="none"
              className="stroke-surface-hover"
              strokeWidth="5"
            />
            <circle
              cx="44"
              cy="44"
              r="36"
              fill="none"
              className={config.ring}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold tabular-nums">
            {profile.leadScore}
          </span>
        </div>

        <div className="min-w-0">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ring-1",
              config.bg,
              config.color,
            )}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {config.label}
          </span>
          <p className="mt-2.5 text-xs leading-relaxed text-text-muted">
            Based on spend, PPV unlocks, and reply frequency.
          </p>
        </div>
      </div>
    </section>
  );
}
