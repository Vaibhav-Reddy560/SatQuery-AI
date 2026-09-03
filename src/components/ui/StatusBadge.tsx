import { Badge, type BadgeProps } from "./Badge";

type Status =
  | "pending" | "processing" | "completed" | "failed"
  | "active" | "archived" | "draft"
  | "generated" | "exported";

const CONFIG: Record<Status, { label: string; variant: BadgeProps["variant"] }> = {
  pending:    { label: "Pending",    variant: "outline" },
  processing: { label: "Processing", variant: "info" },
  completed:  { label: "Completed",  variant: "success" },
  failed:     { label: "Failed",     variant: "danger" },
  active:     { label: "Active",     variant: "success" },
  archived:   { label: "Archived",   variant: "default" },
  draft:      { label: "Draft",      variant: "outline" },
  generated:  { label: "Generated",  variant: "atmos" },
  exported:   { label: "Exported",   variant: "info" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const cfg = CONFIG[status as Status] ?? { label: status, variant: "default" as const };
  return (
    <Badge variant={cfg.variant} className={className}>
      {cfg.label}
    </Badge>
  );
}
