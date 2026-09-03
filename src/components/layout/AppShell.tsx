import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { AmbientBackground } from "./AmbientBackground";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";
import { ease, dur } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Routes that manage their own edge-to-edge canvas and get no page gutter. */
const FULL_BLEED = new Set(["/explore", "/query"]);

export function AppShell() {
  const { pathname } = useLocation();
  const fullBleed = FULL_BLEED.has(pathname);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:rounded-md focus:bg-bg-elevated focus:px-4 focus:py-2 focus:text-body-sm focus:text-text-primary focus:shadow-modal"
      >
        Skip to content
      </a>
      <AmbientBackground />
      <TopBar />
      <Sidebar />
      <CommandPalette />

      <main
        id="main-content"
        className={cn("relative lg:pl-[var(--shell-content-pl)]", fullBleed && "overflow-hidden")}
        style={{ paddingTop: "var(--shell-topbar-h)" }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: dur.base, ease: ease.out }}
            className={cn(
              fullBleed
                ? "h-[calc(100dvh-var(--shell-topbar-h))] p-3"
                : "min-h-[calc(100dvh-var(--shell-topbar-h))]"
            )}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </>
  );
}
