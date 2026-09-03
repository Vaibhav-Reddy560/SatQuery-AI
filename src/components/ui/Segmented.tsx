import * as RadioGroup from "@radix-ui/react-radio-group";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Apple-style segmented control, built on Radix RadioGroup.
 *
 * This is a mutually-exclusive choice with no associated panels, so
 * `radiogroup`/`radio` is the correct ARIA pattern — the previous version
 * asserted `tablist`/`tab` with no `tabpanel` anywhere in the app, which
 * screen readers announce as "tab 2 of 4" while the user hunts for content
 * that doesn't exist. Radix also supplies arrow-key roving focus for free,
 * which the hand-rolled version never had.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  options: { value: T; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const layoutId = `seg-${options.map((x) => x.value).join("")}`;

  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(v) => onChange(v as T)}
      className={cn(
        "inline-flex items-center gap-1 p-1 rounded-md bg-bg-tertiary/70",
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <RadioGroup.Item
            key={o.value}
            value={o.value}
            className={cn(
              "relative flex items-center gap-1.5 rounded-sm font-medium outline-none transition-colors duration-150",
              "focus-visible:ring-2 focus-visible:ring-atmos focus-visible:ring-offset-1 focus-visible:ring-offset-bg-tertiary",
              size === "sm" ? "h-7 px-3 text-xs" : "h-8 px-3.5 text-body-sm",
              active ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-sm bg-bg-elevated shadow-hairline"
                transition={{ type: "spring", stiffness: 480, damping: 40 }}
              />
            )}
            {Icon && <Icon className="relative h-3.5 w-3.5" />}
            <span className="relative whitespace-nowrap">{o.label}</span>
          </RadioGroup.Item>
        );
      })}
    </RadioGroup.Root>
  );
}
