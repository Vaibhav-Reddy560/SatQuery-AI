import * as Radix from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

/**
 * Toggle switch, built on Radix Switch.
 *
 * The previous version hand-asserted `role="switch"` on a plain `<button>`
 * with no keyboard handling beyond the default click — Space/Enter worked
 * by browser default, but there was no `data-state` for CSS, no form
 * association, and no guarantee of matching the real switch keyboard
 * contract. Radix supplies all of that; this wrapper only supplies the look.
 */
export function Switch({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <Radix.Root
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      className={cn(
        "relative h-[26px] w-[46px] rounded-full transition-colors duration-200",
        "data-[state=checked]:bg-accent data-[state=unchecked]:bg-bg-hover",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atmos",
        className
      )}
    >
      <Radix.Thumb
        className={cn(
          "block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
          "translate-x-[3px] data-[state=checked]:translate-x-[23px]"
        )}
      />
    </Radix.Root>
  );
}
