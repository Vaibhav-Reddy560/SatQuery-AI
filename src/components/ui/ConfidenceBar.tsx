import { cn } from "@/lib/utils";

interface ConfidenceBarProps {
  value: number; // 0-1
  showLabel?: boolean;
  className?: string;
}

export function ConfidenceBar({ value, showLabel = true, className }: ConfidenceBarProps) {
  const percentage = Math.round(value * 100);
  const color =
    percentage >= 90
      ? "bg-success"
      : percentage >= 70
        ? "bg-warning"
        : "bg-danger";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showLabel && (
        <span className="text-xs text-text-muted w-8 text-right">{percentage}%</span>
      )}
      <div className="flex-1 h-1.5 bg-bg-primary rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
