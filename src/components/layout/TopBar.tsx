import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Search, Bell, Settings, HelpCircle, LogOut } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Logo } from "@/components/brand/Logo";
import { Kbd } from "@/components/ui/Kbd";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/DropdownMenu";
import { MobileNav } from "./MobileNav";

/**
 * The top bar: page-transient controls only (search, live status,
 * notifications, account). Primary navigation lives in `Sidebar` at `lg`
 * and above, and in `MobileNav` below it — the top bar no longer
 * duplicates either.
 */

const ACCOUNT_LINKS = [
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/help", label: "Help", icon: HelpCircle },
];

function AccountMenu() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={setOpen}
      align="end"
      className="w-52"
      trigger={
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Account"
          className="bevel flex items-center gap-2.5 h-10 pl-1.5 pr-3 rounded-md bg-bg-hover transition-colors duration-150 hover:bg-bg-hover/70"
        >
          <span
            className="flex items-center justify-center h-6 w-6 rounded-full text-[0.625rem] font-bold text-white"
            style={{ background: "linear-gradient(135deg,#3d7fff,#6fb8ff)" }}
            aria-hidden="true"
          >
            AN
          </span>
          <span className="text-body-sm font-medium text-text-primary hidden md:inline">
            Analyst
          </span>
        </button>
      }
    >
      {ACCOUNT_LINKS.map((i) => {
        const Icon = i.icon;
        return (
          <DropdownMenuItem key={i.to} active={i.to === pathname} onSelect={() => navigate(i.to)}>
            <NavLink to={i.to} className="flex items-center gap-2.5">
              <Icon className="h-4 w-4" />
              {i.label}
            </NavLink>
          </DropdownMenuItem>
        );
      })}
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => {}}>
        <button className="flex items-center gap-2.5 w-full text-text-muted">
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </DropdownMenuItem>
    </DropdownMenu>
  );
}

export function TopBar() {
  const setCommandOpen = useAppStore((s) => s.setCommandOpen);

  return (
    /* Same two-layer structure as the landing nav: an outer positioning
       wrapper (no visual styling) that reserves the floating gap, wrapping
       an inner `chrome` pill that actually carries the rounding and
       material. Unlike the landing page, this outer wrapper does NOT
       centre a `max-w-[1400px]` box — that's a marketing-page pattern,
       and on any viewport wider than ~1450px it pushes the pill's left
       edge in by `(viewport-1400)/2 + padding`, a gap that grows with
       screen width, while `Sidebar` sits at the flat, non-scaling
       `--shell-sidebar-gap`. The two drifted apart more the wider the
       screen got. Using that same flat gap here instead keeps the pill
       and the sidebar's left edges pixel-aligned at every width, and lets
       the bar use the dashboard's full available width like the sidebar
       and main content already do. */
    <header className="fixed top-0 inset-x-0 z-50" style={{ height: "var(--shell-topbar-h)" }}>
      {/* The `chrome` pill below is opaque, but it's inset from this
          header's edges by `--shell-sidebar-gap` — without this, whatever
          scrolls past showed through plainly in that gap (and above the
          pill) right up until it hit the pill's hard edge. A full-bleed
          blurred + darkened scrim across the whole reserved strip means
          scrolled content softens away before it reaches the bar instead
          of cutting off sharply. */}
      <div className="absolute inset-0 backdrop-blur-md bg-gradient-to-b from-bg-primary/70 to-bg-primary/0 pointer-events-none" />
      <div className="relative" style={{ padding: "var(--shell-sidebar-gap) var(--shell-sidebar-gap) 0" }}>
        <div className="chrome flex h-16 items-center gap-2 rounded-2xl px-3 sm:px-4 lg:px-6">
          <MobileNav />

          {/* No extra margin — it rides the pill's own padding directly,
              same as the landing nav's logo, instead of sitting further
              in from an additional margin on top of that padding. */}
          <Link
            to="/dashboard"
            className="shrink-0 rounded-md transition-opacity hover:opacity-85"
            aria-label="SatQuery AI — home"
          >
            <Logo size="nav" white />
          </Link>

          <div className="flex-1" />

          {/* Same `bevel` hardware-button treatment as the landing nav's
              "Open workspace" control and the Earth console's deck — the
              top bar is this app's console shell now, not a glass strip. */}
          <button
            onClick={() => setCommandOpen(true)}
            className="bevel hidden sm:flex items-center gap-2.5 h-10 pl-3.5 pr-2 mr-1 rounded-md bg-bg-hover text-text-primary transition-colors duration-150 hover:bg-bg-hover/70"
            aria-label="Open command palette"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="text-body-sm">Search</span>
            <Kbd>⌘K</Kbd>
          </button>

          <button
            className="bevel relative flex items-center justify-center h-10 w-10 rounded-md bg-bg-hover text-text-primary transition-colors duration-150 hover:bg-bg-hover/70"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-atmos" aria-hidden="true" />
          </button>

          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
