import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Num } from "./Num";
import { ease, dur } from "@/lib/motion";

/**
 * Confidence readout. Fills from zero on mount so the value reads as measured
 * rather than declared.
 */
export function ConfidenceBar({
  value,
  showLabel = true,
  className,
}: {
  /** 0–1 */
  value: number;
  showLabel?: boolean;
  className?: string;
}) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);

  // High confidence reads bright (accent -> atmos); low confidence reads
  // dim and desaturated (deep -> metal) — brightness carries the meaning
  // that colour used to, since hue is no longer available for it.
  const fill =
    pct >= 90
      ? "linear-gradient(90deg,#3d7fff,#6fb8ff)"
      : pct >= 70
        ? "linear-gradient(90deg,#78787e,#6fb8ff)"
        : "linear-gradient(90deg,#1f4fc4,#4c4c51)";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 h-1 rounded-full bg-bg-hover overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: fill }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: dur.cinematic, ease: ease.out }}
        />
      </div>
      {showLabel && (
        <Num
          value={pct}
          suffix="%"
          className="text-[0.6875rem] text-text-muted w-9 justify-end shrink-0"
        />
      )}
    </div>
  );
}
