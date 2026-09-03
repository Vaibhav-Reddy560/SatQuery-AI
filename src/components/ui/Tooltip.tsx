import * as Radix from "@radix-ui/react-tooltip";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ease, dur } from "@/lib/motion";

/**
 * Tooltip, built on Radix. Replaces the native `title=` attribute on
 * icon-only controls (map zoom/fullscreen, drawing tools) — `title` has a
 * ~1s hover delay, no touch support, inconsistent styling, and is invisible
 * until the browser decides to show it. This shows on hover AND focus
 * (keyboard users get the same information sighted mouse users do), same
 * Radix + `AnimatePresence` pairing as `DropdownMenu`.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  sideOffset = 6,
}: {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Radix.Root open={open} onOpenChange={setOpen} delayDuration={300}>
      <Radix.Trigger asChild>{children}</Radix.Trigger>
      <AnimatePresence>
        {open && (
          <Radix.Portal forceMount>
            <Radix.Content asChild side={side} sideOffset={sideOffset}>
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: dur.fast, ease: ease.apple }}
                className={cn(
                  "z-[70] px-2.5 py-1.5 rounded-md glass edge-lit shadow-overlay",
                  "text-caption text-text-primary whitespace-nowrap"
                )}
              >
                {content}
              </motion.div>
            </Radix.Content>
          </Radix.Portal>
        )}
      </AnimatePresence>
    </Radix.Root>
  );
}

/** Wrap the app (or a subtree) once so nested Tooltips share hover timing. */
export const TooltipProvider = Radix.Provider;
