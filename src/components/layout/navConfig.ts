import {
  LayoutDashboard, Globe, MessageSquare, ScanSearch, GitCompareArrows,
  Layers, Ruler, FolderOpen, FileText, Settings, HelpCircle,
} from "lucide-react";
import type { ComponentType } from "react";

/**
 * Single source of truth for the app's routes, shared between the desktop
 * `Sidebar`, the `MobileNav` drawer and the `CommandPalette` so none of the
 * three can drift out of sync.
 */

export interface NavLinkDef {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export const PRIMARY: NavLinkDef[] = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/explore", label: "Explore", icon: Globe },
  { to: "/query", label: "Query", icon: MessageSquare },
];

export const ANALYSIS: NavLinkDef[] = [
  { to: "/object-detection", label: "Object Detection", icon: ScanSearch },
  { to: "/change-detection", label: "Change Detection", icon: GitCompareArrows },
  { to: "/land-cover", label: "Land Cover", icon: Layers },
  { to: "/measurements", label: "Measurements", icon: Ruler },
];

export const TRAILING: NavLinkDef[] = [
  { to: "/projects", label: "Projects", icon: FolderOpen },
  { to: "/reports", label: "Reports", icon: FileText },
];

export const UTILITY: NavLinkDef[] = [
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/help", label: "Help", icon: HelpCircle },
];
