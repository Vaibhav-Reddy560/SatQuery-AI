import { useState } from "react";
import {
  ScanSearch,
  Upload,
  Download,
  RefreshCw,
  MapPin,
} from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { objectDetectionResult } from "@/data/mockData";
import { cn } from "@/lib/utils";

export default function ObjectDetection() {
  const result = objectDetectionResult;
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredObjects = selectedCategory
    ? result.detectedObjects.filter((o) => o.category === selectedCategory)
    : result.detectedObjects;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <ScanSearch className="h-5 w-5 text-accent" />
            Object Detection
          </h2>
          <p className="text-sm text-text-muted mt-1">
            AI-powered object detection on satellite imagery
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary bg-bg-tertiary border border-border-default rounded-lg hover:bg-bg-hover transition-colors">
            <Upload className="h-4 w-4" />
            Upload Image
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary bg-bg-tertiary border border-border-default rounded-lg hover:bg-bg-hover transition-colors">
            <Download className="h-4 w-4" />
            Export
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors">
            <RefreshCw className="h-4 w-4" />
            Re-analyze
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Image Preview */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{result.imageName}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status="completed" />
                <span className="text-xs text-text-muted">
                  Processed {new Date(result.processedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Image placeholder with bounding boxes */}
            <div className="relative aspect-[4/3] bg-bg-primary rounded-lg border border-border-subtle overflow-hidden">
              {/* Simulated satellite imagery background */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#1a2332] via-[#111827] to-[#0f172a]">
                {/* Grid overlay */}
                <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="obj-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#3b82f6" strokeWidth="0.3" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#obj-grid)" />
                </svg>

                {/* Fake building patterns */}
                <div className="absolute top-[15%] left-[10%] w-[25%] h-[15%] border-2 border-accent/60 rounded-sm" />
                <div className="absolute top-[15%] left-[10%] -translate-y-4 text-[10px] text-accent bg-bg-primary/80 px-1 rounded">Commercial Complex — 97%</div>

                <div className="absolute top-[10%] left-[44%] w-[15%] h-[22%] border-2 border-accent/60 rounded-sm" />
                <div className="absolute top-[10%] left-[44%] -translate-y-4 text-[10px] text-accent bg-bg-primary/80 px-1 rounded">Office Tower — 94%</div>

                <div className="absolute top-[32%] left-[5%] w-[22%] h-[6%] border-2 border-warning/60 rounded-sm" />
                <div className="absolute top-[32%] left-[5%] -translate-y-4 text-[10px] text-warning bg-bg-primary/80 px-1 rounded">Parking Lot — 91%</div>

                <div className="absolute top-[28%] left-[0%] w-[60%] h-[3%] border-2 border-text-muted/60" />
                <div className="absolute top-[31%] left-[0%] text-[10px] text-text-muted bg-bg-primary/80 px-1 rounded">Highway — 96%</div>

                <div className="absolute top-[40%] left-[50%] w-[15%] h-[12%] border-2 border-success/60 rounded-sm" />
                <div className="absolute top-[40%] left-[50%] -translate-y-4 text-[10px] text-success bg-bg-primary/80 px-1 rounded">Tree Cluster — 89%</div>

                <div className="absolute top-[45%] left-[5%] w-[17%] h-[8%] border-2 border-accent/60 rounded-sm" />
                <div className="absolute top-[53%] left-[5%] text-[10px] text-accent bg-bg-primary/80 px-1 rounded">Residential — 92%</div>

                <div className="absolute top-[42%] left-[33%] w-[12%] h-[2%] border-2 border-[#06b6d4]/60" />
                <div className="absolute top-[44%] left-[33%] text-[10px] text-[#06b6d4] bg-bg-primary/80 px-1 rounded">Drain — 87%</div>

                <div className="absolute top-[18%] left-[17%] w-[7%] h-[4%] border-2 border-[#a855f7]/60 rounded-sm" />
                <div className="absolute top-[22%] left-[17%] text-[10px] text-[#a855f7] bg-bg-primary/80 px-1 rounded">Solar — 93%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Panel */}
        <div className="space-y-4">
          {/* Total Objects */}
          <Card>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold text-text-primary">{result.totalObjects}</div>
                <div className="text-sm text-text-muted mt-1">Objects Detected</div>
              </div>
            </CardContent>
          </Card>

          {/* Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Object Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {result.categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() =>
                      setSelectedCategory(selectedCategory === cat.name ? null : cat.name)
                    }
                    className={cn(
                      "flex items-center gap-3 w-full p-2.5 rounded-lg transition-colors text-left",
                      selectedCategory === cat.name
                        ? "bg-accent-muted border border-accent/30"
                        : "hover:bg-bg-hover border border-transparent"
                    )}
                  >
                    <div
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-text-primary">{cat.name}</span>
                        <span className="text-sm text-text-muted">{cat.count}</span>
                      </div>
                      <div className="mt-1">
                        <ConfidenceBar value={cat.avgConfidence} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardHeader>
              <CardTitle>Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {result.categories.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-xs text-text-secondary">{cat.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detection List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Detected Objects</CardTitle>
          <span className="text-xs text-text-muted">{filteredObjects.length} objects</span>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Category</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Label</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Confidence</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredObjects.map((obj) => (
                  <tr key={obj.id} className="border-b border-border-subtle/50 hover:bg-bg-hover/50 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-sm"
                          style={{ backgroundColor: result.categories.find((c) => c.name === obj.category)?.color }}
                        />
                        <span className="text-text-secondary">{obj.category}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-text-primary font-medium">{obj.label}</td>
                    <td className="py-2.5 px-3">
                      <ConfidenceBar value={obj.confidence} className="w-28" />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button className="p-1 rounded text-text-muted hover:text-accent transition-colors" title="Show on map" aria-label={`Show ${obj.label} on map`}>
                        <MapPin className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
