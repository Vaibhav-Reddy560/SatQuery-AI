import { useNavigate } from "react-router-dom";
import {
  Image as ImageIcon, MapPin, ScanSearch, GitCompareArrows, ArrowUpRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { Page, Section } from "@/components/layout/Page";
import { Button } from "@/components/ui/Button";
import { Num } from "@/components/ui/Num";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { HudFrame } from "@/components/ui/HudFrame";
import {
  dashboardStats, recentActivities, weeklyActivityData, monthlyTrendData,
} from "@/data/mockData";
import { formatTimestamp } from "@/lib/format";
import { CHART, tooltipStyle, tickStyle } from "@/lib/chartTheme";
import { cn, SCREEN_BEZEL, IMAGE_BEZEL } from "@/lib/utils";

const METRICS = [
  { label: "Images analysed", value: dashboardStats.totalImagesAnalyzed, delta: "+12.3%", icon: ImageIcon, tone: "text-accent" },
  { label: "Areas covered", value: dashboardStats.areasAnalyzed, delta: "+8.1%", icon: MapPin, tone: "text-atmos" },
  { label: "Objects detected", value: dashboardStats.objectsDetected, delta: "+15.7%", icon: ScanSearch, tone: "text-success" },
  { label: "Changes flagged", value: dashboardStats.changesDetected, delta: "+22.4%", icon: GitCompareArrows, tone: "text-warning" },
];

const ACTIVITY_TONE: Record<string, string> = {
  analysis: "text-accent",
  detection: "text-atmos",
  change: "text-warning",
  query: "text-info",
  project: "text-text-muted",
};

export default function Overview() {
  const navigate = useNavigate();

  return (
    <Page
      title="Overview"
      subtitle="Everything SatQuery has processed across your active areas of interest."
    >
      {/* ── Headline metrics. No boxes — the numbers carry themselves. ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 xl:gap-x-8 gap-y-10">
        {METRICS.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label}>
              <div className="flex items-center gap-2 mb-4">
                <Icon className={cn("h-4 w-4", m.tone)} />
                {/* `text-text-secondary`, not the standard `text-text-faint`
                    eyebrow — these headline numbers are the first thing on
                    the page and sit on plain `bg-primary`, where the faint
                    token read as barely legible next to the bright coloured
                    icons beside it. */}
                <span className="font-mono text-label uppercase text-text-secondary">{m.label}</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-[3.25rem] leading-none font-thin tracking-[-0.015em] text-text-primary">
                  <Num value={m.value} animate />
                </span>
                <span className="text-[0.8125rem] font-medium text-success">{m.delta}</span>
              </div>
            </div>
          );
        })}
      </section>

      {/* ── The scene. One hero moment. ── */}
      <Section
        title="Active area of interest"
        description="Navi Mumbai, Maharashtra · Esri World Imagery"
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate("/explore")}>
            Explore <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        }
      >
        {/* Chrome housing around the scene — the same console-body /
            inset-screen split every other imagery panel in the app now
            uses (`EarthConsole`, the Explore map, the analysis pages'
            viewports), instead of the image sitting flush with no frame. */}
        <div className="chrome rounded-lg p-3">
          <div
            className="relative overflow-hidden rounded-md aspect-[21/9]"
            style={{ border: IMAGE_BEZEL }}
          >
            <img
              src="/imagery/navi-mumbai.jpg"
              alt="Satellite view of Navi Mumbai"
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, rgba(6,6,7,0.85) 0%, rgba(6,6,7,0.25) 45%, rgba(6,6,7,0.10) 100%)",
              }}
            />
            {/* No `label` prop — the content overlay already has its own
                "Live scene" eyebrow; a second HUD label would duplicate it. */}
            <HudFrame />
            <div className="absolute inset-y-0 left-0 flex flex-col justify-center gap-5 p-10 max-w-[26rem]">
              <div>
                <div className="text-label uppercase text-atmos mb-2">Live scene</div>
                <h3 className="text-heading text-text-primary">Navi Mumbai</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-text-secondary">
                  Urban expansion and mangrove conservation along the coastline.
                </p>
              </div>
              {/* Telemetry on imagery — mono, plain white with a drop
                  shadow for legibility against the scene, not the
                  terminal layer's phosphor glow: a glowing blue readout
                  sitting directly on satellite imagery read as harder to
                  parse than a plain (but crisp) label, not more legible.
                  Sized up from the original caption-scale figures so they
                  actually register as prominent hero numbers. */}
              <div className="flex gap-10 font-mono">
                {[
                  { k: "Resolution", v: "0.5 m" },
                  { k: "Analyses", v: "34" },
                  { k: "Objects", v: "1,284" },
                ].map((s) => (
                  <div key={s.k}>
                    <div
                      className="text-[1.75rem] font-thin tracking-tight text-white"
                      style={{ textShadow: "0 2px 6px rgba(0,0,0,0.85)" }}
                    >
                      {s.v}
                    </div>
                    <div
                      className="text-[0.8125rem] uppercase tracking-[0.08em] text-white/70 mt-1.5"
                      style={{ textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}
                    >
                      {s.k}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Charts + activity — chrome housing around a CRT data readout,
          same console-body / inset-screen split every other panel in the
          app now uses. Chart series keep their own blue-family colours
          (they distinguish "images" from "analyses", the same job the
          activity-type colours below do) and axis ticks stay a neutral
          dim tone — only the surrounding prose (headings, activity title/
          timestamp) moves to phosphor. ── */}
      <Section title="Throughput">
        <div className="chrome rounded-lg p-3">
          <div
            className="crt rounded-md px-6 py-6 bg-bg-primary font-mono text-mono text-phosphor phosphor-glow"
            style={{ boxShadow: SCREEN_BEZEL }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-16">
              <div className="space-y-10">
                <div>
                  <h3 className="text-body-sm font-semibold mb-6">Weekly activity</h3>
                  <div
                    className="h-52"
                    role="img"
                    aria-label="Bar chart comparing images analysed and analyses run for each day of the past week"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyActivityData} barGap={4} accessibilityLayer>
                        <XAxis dataKey="day" tick={tickStyle} axisLine={false} tickLine={false} dy={8} />
                        <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={36} />
                        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: CHART.text }} cursor={{ fill: "rgba(61,127,255,0.06)" }} />
                        <Bar dataKey="images" fill={CHART.accent} radius={[6, 6, 0, 0]} name="Images" />
                        <Bar dataKey="analyses" fill={CHART.atmos} radius={[6, 6, 0, 0]} name="Analyses" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <h3 className="text-body-sm font-semibold mb-6">Monthly detections</h3>
                  <div
                    className="h-52"
                    role="img"
                    aria-label="Area chart of objects detected per month"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyTrendData} accessibilityLayer>
                        <defs>
                          <linearGradient id="gradObjects" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CHART.accent} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={CHART.accent} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="month" tick={tickStyle} axisLine={false} tickLine={false} dy={8} />
                        <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={44} />
                        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: CHART.text }} />
                        <Area type="monotone" dataKey="objects" stroke={CHART.accent} strokeWidth={2} fill="url(#gradObjects)" name="Objects" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Activity as a hairline timeline, not a bordered card. */}
              <div>
                <h3 className="text-body-sm font-semibold mb-6">Recent activity</h3>
                <ol className="relative pl-5">
                  <span className="absolute left-[3px] top-1.5 bottom-1.5 w-px bg-chrome-seam" aria-hidden="true" />
                  {recentActivities.slice(0, 6).map((a) => (
                    <li key={a.id} className="relative pb-7 last:pb-0">
                      <span
                        className={cn("absolute -left-5 top-1.5 h-[7px] w-[7px] rounded-full ring-4 ring-bg-primary", ACTIVITY_TONE[a.type]?.replace("text-", "bg-") ?? "bg-text-muted")}
                        aria-hidden="true"
                      />
                      <div className="flex items-center gap-2.5 mb-1">
                        <span className={cn("text-[0.6875rem] font-semibold uppercase tracking-[0.06em]", ACTIVITY_TONE[a.type] ?? "text-text-secondary")}>
                          {a.type}
                        </span>
                        <StatusBadge status={a.status} />
                      </div>
                      <p className="text-body-sm leading-snug">{a.title}</p>
                      <p className="text-xs text-phosphor-dim [text-shadow:none] mt-1">{formatTimestamp(a.timestamp)}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </Page>
  );
}
