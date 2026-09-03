import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { fadeRise, stagger } from "@/lib/motion";

/**
 * Every page routes through this, so the header is defined once.
 *
 * The old shell rendered the page name in the top bar AND every page rendered
 * its own duplicate <h2> at the same size as a card title. This replaces both
 * with a single 40px title that actually sits at the top of the hierarchy.
 */

interface PageProps {
  /** Small uppercase kicker above the title, e.g. "Analysis". */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Buttons rendered opposite the title. */
  actions?: React.ReactNode;
  /** `canvas` fills the viewport for map/chat surfaces and drops the header. */
  variant?: "default" | "canvas";
  className?: string;
  children: React.ReactNode;
}

export function Page({
  eyebrow,
  title,
  subtitle,
  actions,
  variant = "default",
  className,
  children,
}: PageProps) {
  if (variant === "canvas") {
    return (
      <div className={cn("h-full min-h-0", className)}>{children}</div>
    );
  }

  return (
    /* Right edge pinned to `--shell-sidebar-gap` (the same flat 16px gap
       the nav pill and sidebar both use) instead of a centred
       `max-w-[1180px]` — that centering was a marketing-page pattern:
       fine up to ~1450px, but beyond it the growing centred margin put
       page content's right edge up to 240px away from the nav bar's,
       which is exactly what the misalignment turned out to be. Individual
       long-form paragraphs (the subtitle below, page prose) still cap
       their own line length via `max-w-[Nch]`, so dropping the outer cap
       doesn't invite unreadably wide text blocks. */
    <motion.div
      variants={stagger(0, 0.05)}
      initial="hidden"
      animate="show"
      className={cn("w-full pl-4 sm:pl-6 lg:pl-8 pb-16 lg:pb-24", className)}
      style={{ paddingRight: "var(--shell-sidebar-gap)" }}
    >
      <motion.header
        variants={fadeRise}
        className="flex items-end justify-between gap-6 sm:gap-8 flex-wrap pt-8 pb-8 lg:pt-12 lg:pb-12"
      >
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-label uppercase text-text-faint mb-3">{eyebrow}</div>
          )}
          <h1 className="text-title text-text-primary">{title}</h1>
          {subtitle && (
            <p className="mt-3 max-w-[58ch] text-body leading-[1.5] text-text-secondary">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </motion.header>

      <motion.div variants={fadeRise} className="space-y-14">
        {children}
      </motion.div>
    </motion.div>
  );
}

/**
 * A titled region inside a Page. Borderless — separation comes from the
 * 56px rhythm between sections, not from an outline.
 */
export function Section({
  title,
  description,
  actions,
  className,
  children,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      {(title || actions) && (
        <div className="flex items-end justify-between gap-6 mb-6">
          <div className="min-w-0">
            {title && <h2 className="text-heading text-text-primary">{title}</h2>}
            {description && (
              <p className="mt-2 text-body text-text-muted">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
