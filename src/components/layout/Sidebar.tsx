import { NavLink, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PRIMARY, ANALYSIS, TRAILING, type NavLinkDef } from "./navConfig";
import { SatelliteScreen } from "@/components/ui/SatelliteScreen";
import { useIsFullscreen } from "@/hooks/useIsFullscreen";
import { cn } from "@/lib/utils";

/**
 * The app's primary navigation. Persistent on the left at `lg` and above;
 * below that, `MobileNav` covers the same routes in a drawer.
 *
 * This replaced a horizontal nav crammed into `TopBar` — every route lived
 * one level away from becoming an unlabelled overflow menu. A left rail is
 * the conventional home for primary navigation in a workspace app (Finder,
 * Mail, Linear, Notion); the top bar is reserved for page-transient
 * controls (search, notifications, account) instead of competing for the
 * same job.
 */

// Every group now carries a heading — previously only the middle one
// ("Analysis") did, leaving the other two groupings unexplained gaps with
// no indication of why their items were set apart from one another.
const SECTIONS: { title: string; items: NavLinkDef[] }[] = [
  { title: "Workspace", items: PRIMARY },
  { title: "Analysis", items: ANALYSIS },
  { title: "Library", items: TRAILING },
];

function NavGroup({ title, items }: { title: string; items: NavLinkDef[] }) {
  return (
    <div>
      {/* `text-atmos`, not the standard `text-text-faint` eyebrow — that
          token was reported as effectively invisible here, and explicit
          feedback asked for a light blue specifically WITHOUT a glow, so
          this is plain colour with no `phosphor-glow`/text-shadow. */}
      <div className="px-3 mb-1.5 text-label uppercase text-atmos">{title}</div>
      {/* Each item reads as a hardware button — `bevel` raised at rest,
          `bevel-in` (pressed) for whichever page is current — the same
          two states the Earth console's deck uses for its active toggles,
          rather than a plain flat-highlight nav list. Solid `bg-bg-hover`
          (not the `/40` it used to carry) so these match the top bar's
          Search/Notifications/Account controls exactly: at 40% the blue
          chrome shell read straight through and the buttons came out
          washed-out blue instead of the dark keycaps up in the bar. */}
      <ul className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 h-10 pl-4 pr-3 rounded-md text-body-sm text-text-primary transition-colors duration-150",
                    isActive
                      ? "bevel-in bg-accent-muted font-medium"
                      : "bevel bg-bg-hover hover:bg-bg-hover/70"
                  )
                }
              >
                {/* White at rest AND active — this used to step the icon
                    down to `text-text-muted` (grey) at rest and flip it to
                    `text-accent` (blue) when active. Direct feedback: keep
                    both label and icon white throughout for legibility,
                    let the pill's own bevel-in + accent-muted background
                    carry the "current page" signal instead of the icon. */}
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Sidebar() {
  // Direct feedback: no scrollbar in the nav list while the browser is
  // fullscreen (F11 or the Fullscreen API both recover the vertical space
  // browser chrome normally takes, which is usually enough on its own) —
  // windowed mode keeps the scroll as a fallback for shorter viewports.
  const isFullscreen = useIsFullscreen();

  return (
    <aside
      className="hidden lg:flex fixed z-40 w-[var(--shell-sidebar-w)] flex-col chrome rounded-2xl shadow-overlay"
      style={{
        top: "calc(var(--shell-topbar-h) + var(--shell-sidebar-gap))",
        left: "var(--shell-sidebar-gap)",
        height: "calc(100dvh - var(--shell-topbar-h) - var(--shell-sidebar-gap) * 2)",
      }}
    >
      {/* No `flex-1` — that made the nav absorb all the free space and
          left the dead gap inside it. At `flex: 0 1 auto` it sizes to its
          own content and the free space falls through to the instrument
          panel below; `min-h-0` keeps it able to shrink and scroll when
          the viewport is too short for both. */}
      <nav
        aria-label="Primary"
        className={cn(
          "min-h-0 px-3 pt-5 pb-4 space-y-5",
          isFullscreen ? "overflow-y-hidden" : "overflow-y-auto"
        )}
      >
        {SECTIONS.map((section, i) => (
          <NavGroup key={i} title={section.title} items={section.items} />
        ))}
      </nav>

      {/* Fills whatever is left between the nav list and "Back to site" —
          an instrument readout rather than dead chrome. Outside the
          `<nav>`: it is decorative, not a navigation destination. */}
      <div className="min-h-[14rem] flex-1 px-3 pb-4">
        <SatelliteScreen className="h-full" />
      </div>

      {/* Pinned below the scrollable nav, not inside it — this leaves the
          workspace for the marketing site, so it reads as a distinct exit
          rather than one more destination in the primary route list. Same
          `bevel` hardware-button treatment as every other nav item. */}
      <div className="shrink-0 px-3 pb-4 pt-3 border-t border-chrome-seam">
        <Link
          to="/"
          className="bevel flex items-center gap-3 h-10 pl-4 pr-3 rounded-md bg-bg-hover text-body-sm text-text-primary transition-colors duration-150 hover:bg-bg-hover/70"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="truncate">Back to site</span>
        </Link>
      </div>
    </aside>
  );
}
