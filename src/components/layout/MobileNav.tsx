import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { NavLink, Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X, Search, ChevronRight, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useAppStore } from "@/store/useAppStore";
import { PRIMARY, ANALYSIS, TRAILING, UTILITY } from "./navConfig";
import { cn } from "@/lib/utils";
import { ease, dur } from "@/lib/motion";

/**
 * The mobile navigation drawer.
 *
 * Below `lg` the desktop `<nav>` is `hidden`, and until this component
 * existed there was no replacement anywhere in the codebase — no hamburger,
 * no drawer, nothing. Below 1024px, 9 of the app's 12 routes were reachable
 * only by typing a URL. This is the fix.
 *
 * Built on Radix Dialog so focus trapping, Escape, scroll locking and focus
 * restoration all come for free — the same reasoning as the desktop
 * dropdowns.
 */

// Mirrors the desktop `Sidebar`'s `SECTIONS` — every group carries a
// heading now, not just "Analysis" in the middle.
const SECTIONS: { title: string; items: typeof PRIMARY }[] = [
  { title: "Workspace", items: PRIMARY },
  { title: "Analysis", items: ANALYSIS },
  { title: "Library", items: TRAILING },
  { title: "Utility", items: UTILITY },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const setCommandOpen = useAppStore((s) => s.setCommandOpen);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="bevel flex lg:hidden items-center justify-center h-9 w-9 rounded-md bg-bg-hover text-text-primary transition-colors duration-150 hover:bg-bg-hover/70"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </Dialog.Trigger>

      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: dur.fast }}
                className="fixed inset-0 z-[90] bg-bg-primary/70 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild aria-describedby={undefined}>
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: dur.base, ease: ease.apple }}
                className="fixed inset-y-0 left-0 z-[95] w-[85vw] max-w-xs chrome shadow-modal flex flex-col"
              >
                <div className="flex items-center justify-between h-16 px-5 border-b border-chrome-seam shrink-0">
                  <Dialog.Title asChild>
                    <Logo size="nav" white />
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      className="bevel flex items-center justify-center h-9 w-9 rounded-md bg-bg-hover text-text-primary transition-colors duration-150 hover:bg-bg-hover/70"
                      aria-label="Close navigation menu"
                    >
                      <X className="h-4.5 w-4.5" />
                    </button>
                  </Dialog.Close>
                </div>

                <nav className="flex-1 overflow-y-auto px-3 py-4">
                  <button
                    onClick={() => {
                      setOpen(false);
                      setCommandOpen(true);
                    }}
                    className="bevel flex items-center gap-3 w-full h-11 px-3 mb-4 rounded-md bg-bg-hover text-text-primary transition-colors duration-150 hover:bg-bg-hover/70"
                  >
                    <Search className="h-4 w-4" />
                    <span className="text-body-sm">Search or ask…</span>
                  </button>

                  {SECTIONS.map((section, i) => (
                    <div key={i} className={cn(i > 0 && "mt-5 pt-5 border-t border-chrome-seam")}>
                      {/* `text-atmos`, matching the desktop `Sidebar` fix —
                          `text-text-faint` read as invisible here too. */}
                      <div className="px-3 mb-1.5 text-label uppercase text-atmos">
                        {section.title}
                      </div>
                      <div className="space-y-1">
                        {section.items.map((item) => {
                          const active = pathname === item.to;
                          const Icon = item.icon;
                          return (
                            <NavLink
                              key={item.to}
                              to={item.to}
                              onClick={() => setOpen(false)}
                              className={cn(
                                "flex items-center gap-3 h-11 px-3 rounded-md text-body text-text-primary transition-colors duration-150",
                                active
                                  ? "bevel-in bg-accent-muted font-medium"
                                  : "bevel bg-bg-hover hover:bg-bg-hover/70"
                              )}
                            >
                              {/* White label + icon whether active or not,
                                  matching the desktop sidebar — the pill's
                                  own background carries the "current page"
                                  signal instead of an icon colour change. */}
                              <Icon className="h-4 w-4 shrink-0" />
                              <span className="flex-1 truncate">{item.label}</span>
                              {active && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                            </NavLink>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </nav>

                {/* Pinned below the scrollable nav, same as the desktop
                    sidebar's own footer link — an exit from the workspace
                    to the marketing site, not one more route in the list. */}
                <div className="shrink-0 px-3 pb-4 pt-3 border-t border-chrome-seam">
                  <Link
                    to="/"
                    onClick={() => setOpen(false)}
                    className="bevel flex items-center gap-3 h-11 px-3 rounded-md bg-bg-hover text-body text-text-primary transition-colors duration-150 hover:bg-bg-hover/70"
                  >
                    <ArrowLeft className="h-4 w-4 shrink-0" />
                    <span className="truncate">Back to site</span>
                  </Link>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
