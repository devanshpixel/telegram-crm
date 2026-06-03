import { cn, formatCurrency } from "@/lib/utils";

interface RevenueBadgeProps {
  amount: number;
  size?: "sm" | "md";
  className?: string;
}

export function RevenueBadge({ amount, size = "sm", className }: RevenueBadgeProps) {
  if (amount <= 0) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md font-semibold tabular-nums",
        "bg-revenue-glow text-revenue ring-1 ring-revenue/25",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        className,
      )}
    >
      {formatCurrency(amount, size === "sm")}
    </span>
  );
}
