import { cn } from "@/lib/utils";

interface AvatarProps {
  initials: string;
  colorClass: string;
  size?: "sm" | "md" | "lg" | "xl";
  isOnline?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "h-9 w-9 text-[11px]",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-[72px] w-[72px] text-xl",
};

const dotSize = {
  sm: "h-2.5 w-2.5 border-[1.5px]",
  md: "h-3 w-3 border-2",
  lg: "h-3.5 w-3.5 border-2",
  xl: "h-4 w-4 border-[2.5px]",
};

export function Avatar({
  initials,
  colorClass,
  size = "md",
  isOnline,
  className,
}: AvatarProps) {
  const isGradient = colorClass.startsWith("from-");

  return (
    <div className={cn("relative shrink-0", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-full font-semibold text-white ring-1 ring-white/10",
          sizeMap[size],
          isGradient ? `bg-gradient-to-br ${colorClass}` : colorClass,
        )}
      >
        {initials}
      </div>
      {isOnline !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-black",
            dotSize[size],
            isOnline
              ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
              : "bg-neutral-600",
          )}
          aria-label={isOnline ? "Online" : "Offline"}
        />
      )}
    </div>
  );
}
