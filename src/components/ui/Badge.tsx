import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badge = cva(
  [
    "inline-flex items-center gap-1.5 shrink-0",
    "px-2.5 py-1 rounded-full",
    "text-[0.6875rem] font-semibold leading-none tracking-[0.01em]",
    "border",
  ],
  {
    variants: {
      variant: {
        default: "bg-bg-tertiary text-text-secondary border-border-subtle",
        accent: "bg-accent-muted text-accent border-accent-muted",
        atmos: "bg-atmos-muted text-atmos border-atmos-muted",
        success: "bg-success-muted text-success border-success-muted",
        warning: "bg-warning-muted text-warning border-warning-muted",
        danger: "bg-danger-muted text-danger border-danger-muted",
        info: "bg-info-muted text-info border-info-muted",
        outline: "bg-transparent text-text-muted border-border-default",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badge({ variant }), className)} {...props} />;
}
