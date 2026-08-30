import {
  FolderOpen,
  Plus,
  MapPin,
  Image,
  BarChart3,
  Clock,
  MoreHorizontal,
  Search,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { projects } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { formatDate } from "@/lib/format";

export default function Projects() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-accent" />
            Projects
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Manage your satellite analysis projects
          </p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors">
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary border border-border-default rounded-lg flex-1 max-w-sm">
          <Search className="h-4 w-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none flex-1"
          />
        </div>
        <div className="flex gap-1">
          {["all", "active", "archived", "draft"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize",
                statusFilter === status
                  ? "bg-accent text-white"
                  : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((project) => (
          <Card key={project.id} className="group hover:border-border-default transition-colors cursor-pointer">
            <CardContent>
              <div className="flex items-start justify-between mb-3">
                <StatusBadge status={project.status} />
                <button className="p-1 rounded text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 transition-all">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-1">{project.name}</h3>
              <div className="flex items-center gap-1.5 mb-3">
                <MapPin className="h-3 w-3 text-text-muted" />
                <span className="text-xs text-text-muted">{project.location}</span>
              </div>
              <p className="text-sm text-text-secondary line-clamp-2 mb-4">{project.description}</p>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border-subtle">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5 text-accent" />
                  <span className="text-sm text-text-primary font-medium">{project.analysisCount}</span>
                  <span className="text-xs text-text-muted">analyses</span>
                </div>
                <div className="flex items-center gap-2">
                  <Image className="h-3.5 w-3.5 text-success" />
                  <span className="text-sm text-text-primary font-medium">{project.imageCount}</span>
                  <span className="text-xs text-text-muted">images</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border-subtle">
                <Clock className="h-3 w-3 text-text-muted" />
                <span className="text-[11px] text-text-muted">Updated {formatDate(project.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <FolderOpen className="h-10 w-10 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-muted">No projects found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
