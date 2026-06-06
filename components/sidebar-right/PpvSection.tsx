import { Lock } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { ContactProfile } from "@/types";

interface PpvSectionProps {
  profile: ContactProfile;
}

export function PpvSection({ profile }: PpvSectionProps) {
  const ppvCount = profile.ppvCount ?? 0;
  const avgPerPpv = ppvCount > 0 ? profile.totalSpent / ppvCount : 0;
  const isHot = ppvCount >= 5;

  return (
    <section className="border-b border-border px-5 py-5">
      <div className="mb-3 flex items-center gap-2">
        <Lock className="h-4 w-4 text-revenue" />
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
          PPV activity
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-surface-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">PPV unlocks</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-revenue">
            {ppvCount}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">Avg per PPV</p>
          <p className="mt-1 text-xl font-bold tracking-tight">
            {formatCurrency(avgPerPpv)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-text-muted">
        {ppvCount === 0
          ? "No PPV purchases yet"
          : isHot
            ? "Hot fan — frequent PPV buyer"
            : ppvCount >= 1
              ? "PPV buyer"
              : ""}
      </p>
    </section>
  );
}
