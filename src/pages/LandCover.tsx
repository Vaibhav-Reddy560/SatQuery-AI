import {
  Layers,
  MapPin,
  Calendar,
  Download,
  Info,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/Card";
import { landCoverResult } from "@/data/mockData";

const totalArea = landCoverResult.classifications.reduce((sum, c) => sum + c.area, 0);

export default function LandCover() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Layers className="h-5 w-5 text-accent" />
            Land Cover Classification
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Multi-spectral land cover analysis and classification
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary bg-bg-tertiary border border-border-default rounded-lg hover:bg-bg-hover transition-colors">
            <Download className="h-4 w-4" />
            Export Data
          </button>
        </div>
      </div>

      {/* Info Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 py-3 bg-bg-secondary border border-border-subtle rounded-lg">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-accent shrink-0" />
          <span className="text-sm text-text-primary font-medium">{landCoverResult.location}</span>
        </div>
        <div className="hidden sm:block w-px h-4 bg-border-default" />
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-text-muted shrink-0" />
          <span className="text-sm text-text-muted">Analyzed {new Date(landCoverResult.analyzedAt).toLocaleDateString()}</span>
        </div>
        <div className="hidden sm:block w-px h-4 bg-border-default" />
        <span className="text-sm text-text-muted">Total area: <strong className="text-text-primary">{totalArea.toLocaleString()} km²</strong></span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map / Image Placeholder */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Land Cover Map</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-[4/3] bg-bg-primary rounded-lg border border-border-subtle overflow-hidden">
              <div className="absolute inset-0">
                {/* Stylized land cover visualization */}
                <svg className="w-full h-full" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
                  {/* Cropland (62.4%) - dominant green */}
                  <rect x="0" y="0" width="400" height="300" fill="#1a3a2a" />

                  {/* Build-up area (14.8%) */}
                  <rect x="100" y="50" width="120" height="80" fill="#1a2a4a" rx="4" />

                  {/* Tree cover (6.3%) */}
                  <circle cx="320" cy="200" r="40" fill="#15302a" />
                  <circle cx="340" cy="180" r="25" fill="#1a4030" />

                  {/* Water bodies (4.2%) */}
                  <ellipse cx="80" cy="220" rx="60" ry="30" fill="#0a2a3a" />

                  {/* Grassland (3.0%) */}
                  <rect x="250" y="130" width="80" height="50" fill="#2a3a1a" rx="4" />

                  {/* Bare soil (8.1%) */}
                  <rect x="50" y="100" width="60" height="60" fill="#2a2218" rx="4" />

                  {/* Shrubland (1.2%) */}
                  <rect x="200" y="220" width="40" height="30" fill="#2a2a15" rx="4" />
                </svg>

                {/* Legend overlay */}
                <div className="absolute bottom-3 left-3 bg-bg-primary/90 border border-border-subtle rounded-lg p-3 backdrop-blur-sm">
                  <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Legend</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {landCoverResult.classifications.map((c) => (
                      <div key={c.id} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-[10px] text-text-secondary">{c.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Classification Summary */}
        <div className="space-y-4">
          {/* Pie-like chart */}
          <Card>
            <CardHeader>
              <CardTitle>Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={landCoverResult.classifications} layout="vertical" barSize={16}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} unit="%" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      axisLine={false}
                      tickLine={false}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{ background: "#1e2028", border: "1px solid #2a2d38", borderRadius: 8, fontSize: 11 }}
                      formatter={(value) => [`${value}%`, "Coverage"]}
                    />
                    <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
                      {landCoverResult.classifications.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Classification Cards */}
          <Card>
            <CardHeader>
              <CardTitle>Classifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {landCoverResult.classifications.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-bg-hover transition-colors">
                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: c.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary">{c.name}</div>
                      <div className="text-xs text-text-muted">{c.area.toLocaleString()} km²</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-text-primary">{c.percentage}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Analysis Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-4 w-4 text-accent" />
            Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <h4 className="font-semibold text-text-primary mb-2">Dominant Land Cover</h4>
              <p className="text-text-secondary">
                Cropland is the dominant land cover type at <strong className="text-success">{landCoverResult.classifications[0].percentage}%</strong>,
                covering {landCoverResult.classifications[0].area.toLocaleString()} km². This is consistent with the region's
                agricultural character as a major wheat-producing belt.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-text-primary mb-2">Urban Footprint</h4>
              <p className="text-text-secondary">
                Built-up area accounts for <strong className="text-accent">{landCoverResult.classifications[1].percentage}%</strong> of the
                total area ({landCoverResult.classifications[1].area.toLocaleString()} km²), primarily concentrated along
                major road corridors and the city center.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-text-primary mb-2">Environmental Health</h4>
              <p className="text-text-secondary">
                Tree cover ({landCoverResult.classifications[4].percentage}%) and grassland ({landCoverResult.classifications[5].percentage}%)
                together make up <strong className="text-success">{(landCoverResult.classifications[4].percentage + landCoverResult.classifications[5].percentage).toFixed(1)}%</strong> of
                the landscape, indicating moderate green cover for an agricultural region.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
