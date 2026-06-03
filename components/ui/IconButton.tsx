import { cn } from "@/lib/utils";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  active?: boolean;
}

export function IconButton({
  children,
  active,
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl transition",
        active
          ? "bg-surface-active text-text-primary"
          : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
