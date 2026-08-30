import { useState } from "react";
import {
  Ruler,
  ArrowRight,
  SquareIcon,
  Circle,
  Trash2,
  Download,
  MapPin,
  Clock,
} from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { measurements } from "@/data/mockData";
import type { MeasurementType } from "@/types";
import { cn } from "@/lib/utils";

const toolOptions: { type: MeasurementType; icon: React.ComponentType<{ className?: string }>; label: string; description: string }[] = [
  { type: "distance", icon: ArrowRight, label: "Distance", description: "Measure linear distance between two points" },
  { type: "area", icon: SquareIcon, label: "Area", description: "Calculate enclosed area of a polygon" },
  { type: "perimeter", icon: Circle, label: "Perimeter", description: "Measure perimeter of a shape" },
];

function formatMeasurement(value: number, unit: string) {
  return `${value.toLocaleString()} ${unit}`;
}

export default function Measurements() {
  const [activeTool, setActiveTool] = useState<MeasurementType>("distance");

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Ruler className="h-5 w-5 text-accent" />
            Measurements
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Measure distances, areas, and perimeters on satellite imagery
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary bg-bg-tertiary border border-border-default rounded-lg hover:bg-bg-hover transition-colors">
            <Download className="h-4 w-4" />
            Export All
          </button>
        </div>
      </div>

      {/* Measurement Tools */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {toolOptions.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.type}
              onClick={() => setActiveTool(tool.type)}
              className={cn(
                "p-4 rounded-lg border text-left transition-all",
                activeTool === tool.type
                  ? "border-accent bg-accent-muted/50 ring-1 ring-accent/20"
                  : "border-border-subtle bg-bg-secondary hover:border-border-default hover:bg-bg-hover"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "p-2.5 rounded-lg",
                    activeTool === tool.type ? "bg-accent text-white" : "bg-bg-tertiary text-text-secondary"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-text-primary">{tool.label}</div>
                  <div className="text-xs text-text-muted mt-0.5">{tool.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map / Drawing Area */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Measurement Canvas</span>
              <Badge variant="info">{toolOptions.find((t) => t.type === activeTool)?.label} Tool Active</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-[4/3] bg-bg-primary rounded-lg border border-border-subtle overflow-hidden">
              <div className="absolute inset-0 bg-[#0d0f14]">
                {/* Grid */}
                <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="meas-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a2332" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#meas-grid)" />
                </svg>

                {/* Sample measurement: distance line */}
                {activeTool === "distance" && (
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300">
                    <line x1="50" y1="250" x2="350" y2="50" stroke="#3b82f6" strokeWidth="2" strokeDasharray="6 3" />
                    <circle cx="50" cy="250" r="5" fill="#3b82f6" />
                    <circle cx="350" cy="50" r="5" fill="#3b82f6" />
                    <rect x="160" y="135" width="80" height="24" rx="4" fill="#1e2028" stroke="#2a2d38" />
                    <text x="200" y="151" textAnchor="middle" fill="#3b82f6" fontSize="11" fontFamily="monospace">12.4 km</text>
                  </svg>
                )}

                {/* Sample measurement: area polygon */}
                {activeTool === "area" && (
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300">
                    <polygon points="100,80 300,60 320,220 80,240" fill="rgba(59,130,246,0.1)" stroke="#3b82f6" strokeWidth="2" strokeDasharray="6 3" />
                    <circle cx="100" cy="80" r="4" fill="#3b82f6" />
                    <circle cx="300" cy="60" r="4" fill="#3b82f6" />
                    <circle cx="320" cy="220" r="4" fill="#3b82f6" />
                    <circle cx="80" cy="240" r="4" fill="#3b82f6" />
                    <rect x="155" y="140" width="90" height="24" rx="4" fill="#1e2028" stroke="#2a2d38" />
                    <text x="200" y="156" textAnchor="middle" fill="#3b82f6" fontSize="11" fontFamily="monospace">8.7 km²</text>
                  </svg>
                )}

                {/* Sample measurement: perimeter */}
                {activeTool === "perimeter" && (
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300">
                    <ellipse cx="200" cy="150" rx="120" ry="80" fill="rgba(34,197,94,0.08)" stroke="#22c55e" strokeWidth="2" strokeDasharray="6 3" />
                    <rect x="155" y="138" width="90" height="24" rx="4" fill="#1e2028" stroke="#2a2d38" />
                    <text x="200" y="154" textAnchor="middle" fill="#22c55e" fontSize="11" fontFamily="monospace">28.6 km</text>
                  </svg>
                )}

                {/* Instruction */}
                <div className="absolute bottom-3 left-3 text-xs text-text-muted bg-bg-primary/80 px-2 py-1 rounded backdrop-blur-sm">
                  Click on the map to add measurement points
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Measurement History */}
        <Card className="flex flex-col">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Measurement History</CardTitle>
            <button className="text-xs text-text-muted hover:text-danger transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            <div className="space-y-2">
              {measurements.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "p-3 rounded-lg border transition-colors",
                    m.type === activeTool
                      ? "border-accent/50 bg-accent-muted/30"
                      : "border-border-subtle hover:bg-bg-hover"
                  )}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={m.type === "distance" ? "info" : m.type === "area" ? "success" : "default"}>
                        {m.type.charAt(0).toUpperCase() + m.type.slice(1)}
                      </Badge>
                    </div>
                    <button className="text-text-muted hover:text-accent transition-colors" title="Show on map">
                      <MapPin className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="text-lg font-bold text-text-primary">{formatMeasurement(m.value, m.unit)}</div>
                  <div className="text-xs text-text-secondary mt-0.5">{m.label}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3 text-text-muted" />
                    <span className="text-[10px] text-text-muted">{new Date(m.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
