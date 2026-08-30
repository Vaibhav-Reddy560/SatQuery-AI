import { useLocation } from "react-router-dom";
import { Search, Bell, Moon, Sun, User, Command } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useState } from "react";

const pageTitles: Record<string, string> = {
  "/": "Overview",
  "/explore": "Explore",
  "/query": "Query",
  "/object-detection": "Object Detection",
  "/change-detection": "Change Detection",
  "/land-cover": "Land Cover",
  "/measurements": "Measurements",
  "/projects": "Projects",
  "/reports": "Reports",
  "/settings": "Settings",
  "/help": "Help",
};

export function Header() {
  const location = useLocation();
  const { setGlobalSearchOpen } = useAppStore();
  const [isDark, setIsDark] = useState(true);

  const title = pageTitles[location.pathname] || "SatQuery";

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-border-default bg-bg-secondary/80 backdrop-blur-sm">
      {/* Page Title */}
      <h1 className="text-base font-semibold text-text-primary">{title}</h1>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Global Search */}
        <button
          onClick={() => setGlobalSearchOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted bg-bg-tertiary border border-border-default rounded-md hover:border-border-default/80 hover:text-text-secondary transition-colors"
          aria-label="Open search"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search locations...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-text-muted bg-bg-primary border border-border-subtle rounded">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full" aria-hidden="true" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={() => setIsDark(!isDark)}
          className="p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* User Profile */}
        <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-md hover:bg-bg-hover transition-colors" aria-label="User profile">
          <div className="h-7 w-7 rounded-full bg-accent-muted flex items-center justify-center">
            <User className="h-3.5 w-3.5 text-accent" />
          </div>
          <span className="text-sm text-text-secondary hidden md:inline">Analyst</span>
        </button>
      </div>
    </header>
  );
}
