import { cn } from "@/lib/utils";
import { Card } from "./Card";
import { Num } from "./Num";

/**
 * The Apple "big readout" tile: a hairline-weight numeral at large size with
 * tabular figures, over a soft radial wash.
 *
 * The numeral counts up once when the tile scrolls into view. Tabular figures
 * matter here — without them the number visibly jitters as it counts.
 */

type Tone = "accent" | "atmos" | "warning" | "success" | "info";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  className?: string;
}

const TONE_TEXT: Record<Tone, string> = {
  accent: "text-accent",
  atmos: "text-atmos",
  warning: "text-warning",
  success: "text-success",
  info: "text-info",
};

const TONE_BG: Record<Tone, string> = {
  accent: "bg-accent-muted",
  atmos: "bg-atmos-muted",
  warning: "bg-warning-muted",
  success: "bg-success-muted",
  info: "bg-info-muted",
};

export function StatCard({
  label,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  tone = "accent",
  className,
}: StatCardProps) {
  return (
    <Card variant="glow" glow={tone} glowFrom="top-right" interactive className={cn("group", className)}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-6">
          <div
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-md",
              TONE_BG[tone]
            )}
          >
            <Icon className={cn("h-4 w-4", TONE_TEXT[tone])} />
          </div>
          {change && (
            <span
              className={cn(
                "text-[0.6875rem] font-semibold px-2 py-1 rounded-full leading-none",
                changeType === "positive" && "text-success bg-success-muted",
                changeType === "negative" && "text-danger bg-danger-muted",
                changeType === "neutral" && "text-text-muted bg-bg-tertiary"
              )}
            >
              {change}
            </span>
          )}
        </div>

        <div className="text-metric text-text-primary">
          {typeof value === "number" ? <Num value={value} animate /> : value}
        </div>
        <div className="text-xs text-text-muted mt-2">{label}</div>
      </div>
    </Card>
  );
}

export { StatCard as StatTile };
