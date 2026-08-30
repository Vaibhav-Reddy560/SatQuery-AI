import {
  Image,
  MapPin,
  ScanSearch,
  GitCompareArrows,
  ArrowUpRight,
  Clock,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { dashboardStats, recentActivities, weeklyActivityData, monthlyTrendData } from "@/data/mockData";
import { useNavigate } from "react-router-dom";
import { formatTimestamp } from "@/lib/format";

const activityTypeColors: Record<string, string> = {
  analysis: "text-accent",
  detection: "text-success",
  change: "text-warning",
  query: "text-accent",
  project: "text-text-muted",
};

export default function Overview() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Images Analyzed" value={dashboardStats.totalImagesAnalyzed} change="+12.3%" changeType="positive" icon={Image} />
        <StatCard label="Areas Analyzed" value={dashboardStats.areasAnalyzed} change="+8.1%" changeType="positive" icon={MapPin} />
        <StatCard label="Objects Detected" value={dashboardStats.objectsDetected} change="+15.7%" changeType="positive" icon={ScanSearch} />
        <StatCard label="Changes Detected" value={dashboardStats.changesDetected} change="+22.4%" changeType="positive" icon={GitCompareArrows} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyActivityData} barGap={2}>
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    contentStyle={{ background: "#1e2028", border: "1px solid #2a2d38", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#e8eaed" }}
                  />
                  <Bar dataKey="images" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Images" />
                  <Bar dataKey="analyses" fill="#22c55e" radius={[3, 3, 0, 0]} name="Analyses" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Detections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrendData}>
                  <defs>
                    <linearGradient id="gradObjects" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    contentStyle={{ background: "#1e2028", border: "1px solid #2a2d38", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#e8eaed" }}
                  />
                  <Area type="monotone" dataKey="objects" stroke="#3b82f6" fill="url(#gradObjects)" name="Objects" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Workspace Preview */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Workspace Preview</CardTitle>
            <button
              onClick={() => navigate("/explore")}
              className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
            >
              Open workspace <ArrowUpRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent>
            <div className="relative h-64 rounded-md overflow-hidden bg-bg-primary border border-border-subtle">
              {/* Map placeholder */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-full h-full bg-[#111318] relative">
                    {/* Stylized map grid lines */}
                    <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#3b82f6" strokeWidth="0.5" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-muted mb-3">
                          <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                          </svg>
                        </div>
                        <p className="text-sm text-text-muted">Satellite analysis workspace</p>
                        <p className="text-xs text-text-muted mt-1">Click "Open workspace" to explore</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {recentActivities.slice(0, 6).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="mt-1">
                    <Clock className="h-3.5 w-3.5 text-text-muted" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${activityTypeColors[activity.type] ?? "text-text-secondary"}`}>
                        {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                      </span>
                      <StatusBadge status={activity.status} />
                    </div>
                    <p className="text-sm text-text-primary mt-0.5 truncate">{activity.title}</p>
                    <p className="text-xs text-text-muted mt-0.5">{formatTimestamp(activity.timestamp)}</p>
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
