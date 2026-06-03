import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "accent" | "success" | "warning" | "danger" | "revenue";
  className?: string;
}

const variants = {
  default: "bg-surface-hover text-text-secondary ring-1 ring-border",
  accent: "bg-accent-glow text-accent ring-1 ring-accent/20",
  success: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  danger: "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20",
  revenue: "bg-revenue-glow text-revenue ring-1 ring-revenue/25",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
