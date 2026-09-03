import { cn } from "@/lib/utils";

export function Kbd({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center gap-0.5",
        "min-w-[1.375rem] h-[1.375rem] px-1.5",
        "rounded-[6px] border border-border-default bg-bg-primary",
        "text-[0.625rem] font-semibold text-text-muted leading-none",
        className
      )}
    >
      {children}
    </kbd>
  );
}
