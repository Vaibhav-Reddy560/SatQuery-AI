import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
}

export function StatCard({ label, value, change, changeType = "neutral", icon: Icon }: StatCardProps) {
  return (
    <div className="bg-bg-secondary border border-border-subtle rounded-lg p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-md bg-accent-muted">
          <Icon className="h-4 w-4 text-accent" />
        </div>
        {change && (
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              changeType === "positive" && "text-success bg-success-muted",
              changeType === "negative" && "text-danger bg-danger-muted",
              changeType === "neutral" && "text-text-muted bg-bg-tertiary"
            )}
          >
            {change}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-text-primary">{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div className="text-sm text-text-muted mt-1">{label}</div>
    </div>
  );
}
