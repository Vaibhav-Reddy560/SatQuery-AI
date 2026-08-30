import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Globe,
  MessageSquare,
  ScanSearch,
  GitCompareArrows,
  Layers,
  Ruler,
  FolderOpen,
  FileText,
  Settings,
  HelpCircle,
  ChevronLeft,
  Satellite,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "WORKSPACE",
    items: [
      { to: "/", label: "Overview", icon: LayoutDashboard },
      { to: "/explore", label: "Explore", icon: Globe },
      { to: "/query", label: "Query", icon: MessageSquare },
    ],
  },
  {
    title: "ANALYSIS",
    items: [
      { to: "/object-detection", label: "Object Detection", icon: ScanSearch },
      { to: "/change-detection", label: "Change Detection", icon: GitCompareArrows },
      { to: "/land-cover", label: "Land Cover", icon: Layers },
      { to: "/measurements", label: "Measurements", icon: Ruler },
    ],
  },
  {
    title: "PROJECT",
    items: [
      { to: "/projects", label: "Projects", icon: FolderOpen },
      { to: "/reports", label: "Reports", icon: FileText },
    ],
  },
];

const bottomNav: NavItem[] = [
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/help", label: "Help", icon: HelpCircle },
];

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
          isActive
            ? "bg-accent-muted text-accent font-medium"
            : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  return (
    <aside
      className={cn(
        "h-screen flex flex-col bg-bg-secondary border-r border-border-default transition-all duration-200",
        sidebarCollapsed ? "w-16" : "w-60"
      )}
    >
      {/* Brand */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border-subtle">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <Satellite className="h-5 w-5 text-accent shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-wide text-text-primary">SATQUERY</div>
              <div className="text-[10px] text-text-muted tracking-wider uppercase">Satellite Intelligence</div>
            </div>
          </div>
        )}
        {sidebarCollapsed && <Satellite className="h-5 w-5 text-accent mx-auto" />}
        <button
          onClick={toggleSidebar}
          className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          aria-label="Toggle sidebar"
        >
          <ChevronLeft
            className={cn("h-4 w-4 transition-transform", sidebarCollapsed && "rotate-180")}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
        {navSections.map((section) => (
          <div key={section.title}>
            {!sidebarCollapsed && (
              <div className="px-3 mb-1.5 text-[10px] font-semibold tracking-widest text-text-muted uppercase">
                {section.title}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarLink key={item.to} item={item} collapsed={sidebarCollapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="border-t border-border-subtle py-2 px-2 space-y-0.5">
        {bottomNav.map((item) => (
          <SidebarLink key={item.to} item={item} collapsed={sidebarCollapsed} />
        ))}
      </div>
    </aside>
  );
}
