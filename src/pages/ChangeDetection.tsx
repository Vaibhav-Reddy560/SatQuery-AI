import { Download, Building2, TreePine, Waves, Layers } from "lucide-react";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/Button";
import { Num, Km2 } from "@/components/ui/Num";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { CompareSlider } from "@/components/ui/CompareSlider";
import { changeDetectionResult } from "@/data/mockData";
import { cn, SCREEN_BEZEL, IMAGE_BEZEL } from "@/lib/utils";

const result = changeDetectionResult;

/**
 * Real acquisition dates from the Esri World Imagery Wayback archive — these
 * are two genuinely different captures of the same coordinates, not one image
 * processed twice. See public/imagery/provenance.json.
 */
const ACQUIRED = { before: "7 March 2024", after: "5 August 2026" };

const CHANGE_META: Record<string, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  new_construction: { icon: Building2, tone: "text-accent" },
  demolition: { icon: Layers, tone: "text-danger" },
  vegetation_change: { icon: TreePine, tone: "text-success" },
  water_change: { icon: Waves, tone: "text-atmos" },
  land_use_change: { icon: Layers, tone: "text-warning" },
};

const STATS = [
  { key: "totalAreaChanged", label: "Total changed" },
  { key: "newConstruction", label: "New construction" },
  { key: "demolished", label: "Demolished" },
  { key: "vegetationLoss", label: "Vegetation loss" },
  { key: "vegetationGain", label: "Vegetation gain" },
] as const;

export default function ChangeDetection() {
  return (
    <Page
      title="Change detection"
      subtitle={`${result.location} · two acquisitions, ${ACQUIRED.before} and ${ACQUIRED.after}.`}
      actions={
        <Button variant="primary" size="sm">
          <Download className="h-3.5 w-3.5" /> Export report
        </Button>
      }
    >
      {/* ── The comparison is the hero. Drag to wipe. Chrome housing
          around the slider — same console-body / inset-screen split as
          `EarthConsole` and the Explore map, instead of the imagery
          sitting flush with no frame. A thin `chrome-high` edge frames
          the screen itself (not just the outer shell), and a slight inset
          shadow gives the imagery a touch of depth without the heavy
          sunken-pocket look this had before. ── */}
      <section>
        <div className="chrome rounded-lg p-3">
          <div
            className="rounded-md overflow-hidden"
            style={{ border: IMAGE_BEZEL }}
          >
            <CompareSlider
              beforeSrc="/imagery/change-before.jpg"
              afterSrc="/imagery/change-after.jpg"
              beforeLabel={ACQUIRED.before}
              afterLabel={ACQUIRED.after}
              className="rounded-none"
            />
          </div>
          <div className="mt-3 px-1 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-white">Drag to compare · Esri World Imagery Wayback</p>
            {/* Plain white, not the phosphor `Readout` — this caption sits
                on the `chrome` housing itself, not a CRT screen, so the
                terminal layer's bright glowing blue read as a mismatched,
                harder-to-read accent next to the plain white caption
                beside it rather than a deliberate contrast. */}
            <div className="flex items-center gap-2 text-xs text-white">
              <span className="text-white/60 uppercase tracking-wide">Location</span>
              <span className="font-medium">{result.location}</span>
              <StatusBadge status={result.status} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Statistics — CRT terminal readout: these are instrument-
          derived numbers from this specific analysis, not a dashboard
          summary (Overview's own headline metrics stay un-boxed on
          purpose), so they get the same treatment as the project/report
          cards' and Measurements' text panels. */}
      <div className="chrome rounded-lg p-3">
        <div
          className="crt rounded-md px-5 py-5 bg-bg-primary font-mono text-mono text-phosphor phosphor-glow"
          style={{ boxShadow: SCREEN_BEZEL }}
        >
          {/* `1fr` columns gave every stat the same track width regardless
              of how short its label/value actually were, so the last
              column's short text sat with a big gap before the box's own
              right edge instead of flush against it. `auto` columns
              (sized to content) plus `justify-between` spread them across
              the full width instead, with the first flush-left and the
              last flush-right. */}
          <div className="grid grid-cols-[repeat(2,auto)] md:grid-cols-[repeat(3,auto)] lg:grid-cols-[repeat(5,auto)] justify-between gap-x-8 gap-y-8">
            {STATS.map((s) => (
              <div key={s.key}>
                <div className="text-[0.6875rem] uppercase tracking-[0.06em] text-phosphor-dim [text-shadow:none] mb-2">
                  {s.label}
                </div>
                <div className="text-[2rem] leading-none font-thin tracking-[-0.012em]">
                  <Km2 value={result.statistics[s.key]} animate />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Detected changes — same CRT readout list as `LandCover`'s
          breakdown and Measurements' "Saved" panel. Change-type icons
          keep their existing tones (they distinguish categories from
          each other, the same job the land-cover dots do), everything
          else steps down to `phosphor-dim`. */}
      <div className="chrome rounded-lg p-3">
        <div
          className="crt rounded-md px-5 py-4 bg-bg-primary font-mono text-mono text-phosphor phosphor-glow"
          style={{ boxShadow: SCREEN_BEZEL }}
        >
          <div className="flex items-baseline justify-between gap-4 mb-1">
            <div className="text-label uppercase text-phosphor-dim [text-shadow:none]">Detected changes</div>
            <div className="text-[0.6875rem] text-phosphor-dim [text-shadow:none]">
              {result.changes.length} regions flagged
            </div>
          </div>
          <div className="divide-y divide-chrome-seam/60">
            {result.changes.map((c) => {
              const meta = CHANGE_META[c.type] ?? CHANGE_META.land_use_change;
              const Icon = meta.icon;
              return (
                <div
                  key={c.id}
                  className="grid grid-cols-1 md:grid-cols-[1fr_7rem_10rem] items-center gap-x-6 gap-y-3 py-5"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <Icon className={cn("h-[1.125rem] w-[1.125rem] shrink-0 mt-0.5", meta.tone)} />
                    <div className="min-w-0">
                      <p className="text-body-sm leading-snug">{c.description}</p>
                      <p className="text-[0.6875rem] text-phosphor-dim [text-shadow:none] mt-1 capitalize">
                        {c.type.replace(/_/g, " ")}
                      </p>
                    </div>
                  </div>
                  <div className="text-body-sm text-phosphor-dim [text-shadow:none]">
                    <Num value={c.area} decimals={1} suffix=" km" />
                    <sup className="text-[0.62em] relative -top-[0.34em]">2</sup>
                  </div>
                  <ConfidenceBar value={c.confidence} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Page>
  );
}
