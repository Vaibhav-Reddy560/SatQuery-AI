import { cn } from "@/lib/utils";
import type { AnalysisStatus, ProjectStatus, ReportStatus } from "@/types";

type AllStatuses = AnalysisStatus | ProjectStatus | ReportStatus;

const statusConfig: Record<AllStatuses, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-warning-muted text-warning" },
  processing: { label: "Processing", className: "bg-accent-muted text-accent" },
  completed: { label: "Completed", className: "bg-success-muted text-success" },
  failed: { label: "Failed", className: "bg-danger-muted text-danger" },
  active: { label: "Active", className: "bg-success-muted text-success" },
  archived: { label: "Archived", className: "bg-bg-tertiary text-text-muted" },
  draft: { label: "Draft", className: "bg-warning-muted text-warning" },
  generated: { label: "Generated", className: "bg-success-muted text-success" },
  exported: { label: "Exported", className: "bg-accent-muted text-accent" },
};

interface StatusBadgeProps {
  status: AllStatuses;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: "bg-bg-tertiary text-text-muted" };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
