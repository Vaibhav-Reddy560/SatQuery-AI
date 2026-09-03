import * as Radix from "@radix-ui/react-dropdown-menu";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { ease, dur } from "@/lib/motion";

/**
 * Dropdown menu, built on Radix.
 *
 * The two hand-rolled menus this replaces (`TopBar`'s Analysis and Account
 * menus) had `role="menu"` asserted with no roving tabindex, no arrow-key
 * navigation, and — in one of the two — no Escape handler at all, which was
 * a real keyboard trap in the only menu that exists below the `lg`
 * breakpoint. Radix supplies all of that; this wrapper only supplies the look.
 *
 * Combines Radix (`forceMount`) with `AnimatePresence` for exit animation —
 * the documented pattern for pairing the two.
 */

export function DropdownMenu({
  open,
  onOpenChange,
  trigger,
  children,
  align = "start",
  sideOffset = 8,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  sideOffset?: number;
  className?: string;
}) {
  return (
    <Radix.Root open={open} onOpenChange={onOpenChange}>
      <Radix.Trigger asChild>{trigger}</Radix.Trigger>
      <AnimatePresence>
        {open && (
          <Radix.Portal forceMount>
            <Radix.Content asChild align={align} sideOffset={sideOffset}>
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -3, scale: 0.98 }}
                transition={{ duration: dur.fast, ease: ease.apple }}
                style={{
                  // Radix's Popper positions this via a wrapper `transform:
                  // translate(...)` that changes with `align`/`side` — the
                  // scale animation needs to grow FROM the corner nearest
                  // whatever edge Radix anchored to, not from the box's own
                  // center (Motion's default). Center-origin scaling reads
                  // as the menu "popping" out of nowhere; anchoring the
                  // origin to match `align` makes it unfurl from the
                  // trigger instead, which is what actually looked like a
                  // stray jerk next to the button.
                  transformOrigin: align === "end" ? "top right" : align === "center" ? "top center" : "top left",
                }}
                className={cn(
                  "z-[60] w-60 p-2 rounded-lg glass edge-lit shadow-overlay",
                  className
                )}
              >
                {children}
              </motion.div>
            </Radix.Content>
          </Radix.Portal>
        )}
      </AnimatePresence>
    </Radix.Root>
  );
}

const itemClass = (active?: boolean) =>
  cn(
    "flex items-center gap-2.5 h-10 px-3 rounded-md text-body-sm outline-none transition-colors duration-150",
    "data-[highlighted]:bg-bg-hover data-[highlighted]:text-text-primary",
    active ? "bg-accent-muted text-accent font-medium" : "text-text-secondary"
  );

/** A menu item that renders arbitrary content (a `NavLink`, a `<button>`, …). */
export function DropdownMenuItem({
  active,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Radix.Item> & { active?: boolean }) {
  return (
    <Radix.Item asChild className={cn(itemClass(active), className)} {...props}>
      {children}
    </Radix.Item>
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <Radix.Separator className={cn("my-1.5 h-px bg-border-subtle", className)} />;
}
