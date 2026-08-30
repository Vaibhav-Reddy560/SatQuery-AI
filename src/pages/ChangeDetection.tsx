import { useState } from "react";
import {
  GitCompareArrows,
  Calendar,
  MapPin,
  TrendingUp,
  TrendingDown,
  Building2,
  TreePine,
  Droplets,
  LandPlot,
  Download,
} from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { changeDetectionResult } from "@/data/mockData";
import type { DetectedChange } from "@/types";

const changeTypeConfig: Record<DetectedChange["type"], { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  new_construction: { icon: Building2, color: "text-accent", label: "New Construction" },
  demolition: { icon: Building2, color: "text-danger", label: "Demolition" },
  vegetation_change: { icon: TreePine, color: "text-success", label: "Vegetation Change" },
  water_change: { icon: Droplets, color: "text-[#06b6d4]", label: "Water Change" },
  land_use_change: { icon: LandPlot, color: "text-warning", label: "Land Use Change" },
};

export default function ChangeDetection() {
  const result = changeDetectionResult;
  const [selectedChange, setSelectedChange] = useState<string | null>(null);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-accent" />
            Change Detection
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Compare satellite imagery over time to detect changes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary bg-bg-tertiary border border-border-default rounded-lg hover:bg-bg-hover transition-colors">
            <Download className="h-4 w-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Comparison Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Before Image */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Before</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="h-3 w-3 text-text-muted" />
                <span className="text-xs text-text-muted">{result.beforeDate}</span>
              </div>
            </div>
            <Badge variant="info">Before</Badge>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-[4/3] bg-bg-primary rounded-lg border border-border-subtle overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1a2332] to-[#0d1520]">
                {/* Before state: more green areas */}
                <svg className="absolute inset-0 w-full h-full opacity-15" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="before-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#22c55e" strokeWidth="0.3" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#before-grid)" />
                </svg>
                {/* Vegetation areas (before) */}
                <div className="absolute top-[20%] left-[10%] w-[30%] h-[25%] bg-success/10 border border-success/30 rounded" />
                <div className="absolute top-[50%] left-[5%] w-[20%] h-[20%] bg-success/10 border border-success/30 rounded" />
                <div className="absolute top-[30%] left-[45%] w-[25%] h-[30%] bg-success/10 border border-success/30 rounded" />
                <div className="absolute bottom-[15%] right-[15%] w-[20%] h-[15%] bg-success/10 border border-success/30 rounded" />
                <div className="absolute bottom-[10%] left-[10%] text-xs text-success/80 font-medium">Mangrove Area</div>
                <div className="absolute top-[10%] right-[10%] text-xs text-success/80 font-medium">Forest Cover</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* After Image */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>After</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="h-3 w-3 text-text-muted" />
                <span className="text-xs text-text-muted">{result.afterDate}</span>
              </div>
            </div>
            <Badge variant="warning">After</Badge>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-[4/3] bg-bg-primary rounded-lg border border-border-subtle overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1a2332] to-[#0d1520]">
                <svg className="absolute inset-0 w-full h-full opacity-15" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="after-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#3b82f6" strokeWidth="0.3" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#after-grid)" />
                </svg>
                {/* After state: more construction, less green */}
                <div className="absolute top-[20%] left-[10%] w-[30%] h-[25%] bg-accent/10 border border-accent/30 rounded" />
                <div className="absolute top-[50%] left-[5%] w-[20%] h-[20%] bg-success/10 border border-success/30 rounded opacity-50" />
                <div className="absolute top-[30%] left-[45%] w-[25%] h-[30%] bg-accent/10 border border-accent/30 rounded" />
                <div className="absolute bottom-[15%] right-[15%] w-[20%] h-[15%] bg-warning/10 border border-warning/30 rounded" />
                <div className="absolute bottom-[10%] left-[10%] text-xs text-danger/80 font-medium">Vegetation Lost</div>
                <div className="absolute top-[10%] right-[10%] text-xs text-accent/80 font-medium">New Construction</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <LandPlot className="h-4 w-4 text-accent" />
              <span className="text-xs text-text-muted">Total Changed</span>
            </div>
            <div className="text-xl font-bold text-text-primary">{result.statistics.totalAreaChanged} km²</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-accent" />
              <span className="text-xs text-text-muted">New Construction</span>
            </div>
            <div className="text-xl font-bold text-text-primary">{result.statistics.newConstruction} km²</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-danger" />
              <span className="text-xs text-text-muted">Demolished</span>
            </div>
            <div className="text-xl font-bold text-text-primary">{result.statistics.demolished} km²</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-danger" />
              <span className="text-xs text-text-muted">Vegetation Loss</span>
            </div>
            <div className="text-xl font-bold text-text-primary">{result.statistics.vegetationLoss} km²</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-success" />
              <span className="text-xs text-text-muted">Vegetation Gain</span>
            </div>
            <div className="text-xl font-bold text-text-primary">{result.statistics.vegetationGain} km²</div>
          </CardContent>
        </Card>
      </div>

      {/* Detected Changes List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Detected Changes</CardTitle>
          <div className="flex items-center gap-2">
            <StatusBadge status={result.status} />
            <span className="text-xs text-text-muted flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {result.location}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {result.changes.map((change) => {
              const config = changeTypeConfig[change.type];
              const Icon = config.icon;
              return (
                <div
                  key={change.id}
                  className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                    selectedChange === change.id
                      ? "border-accent/50 bg-accent-muted/50"
                      : "border-border-subtle hover:border-border-default hover:bg-bg-hover/50"
                  }`}
                  onClick={() => setSelectedChange(selectedChange === change.id ? null : change.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-md bg-bg-tertiary ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary">{config.label}</span>
                        <Badge variant={change.type === "new_construction" ? "info" : change.type === "vegetation_change" ? "success" : "default"}>
                          {change.area} km²
                        </Badge>
                      </div>
                      <p className="text-sm text-text-secondary mt-1">{change.description}</p>
                      <div className="mt-2 w-48">
                        <ConfidenceBar value={change.confidence} />
                      </div>
                    </div>
                    <button className="px-3 py-1.5 text-xs font-medium text-accent bg-accent-muted rounded-md hover:bg-accent hover:text-white transition-colors shrink-0">
                      Show on map
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
