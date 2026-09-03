import { useState } from "react";
import { Download } from "lucide-react";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/Button";
import { Num, Km2 } from "@/components/ui/Num";
import { ImageViewport } from "@/components/ui/ImageViewport";
import { Readout } from "@/components/ui/Readout";
import { landCoverResult } from "@/data/mockData";
import { brandColor } from "@/lib/palette";
import { formatDate } from "@/lib/format";
import { cn, SCREEN_BEZEL, IMAGE_BEZEL } from "@/lib/utils";

const result = landCoverResult;
const TOTAL = result.classifications.reduce((s, c) => s + c.area, 0);

/** Thin-ring donut. Hand-rolled SVG — Recharts adds 109KB for this one shape. */
function Donut({
  active,
  onHover,
}: {
  active: string | null;
  onHover: (id: string | null) => void;
}) {
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90" aria-hidden="true">
      {result.classifications.map((c) => {
        const len = (c.percentage / 100) * C;
        const el = (
          <circle
            key={c.id}
            cx="70"
            cy="70"
            r={R}
            fill="none"
            stroke={brandColor(c.color)}
            strokeWidth={active === c.id ? 18 : 13}
            strokeDasharray={`${len} ${C - len}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            opacity={active && active !== c.id ? 0.28 : 1}
            className="transition-all duration-200 cursor-pointer"
            onMouseEnter={() => onHover(c.id)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onHover(c.id)}
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

export default function LandCover() {
  const [active, setActive] = useState<string | null>(null);
  const focused = result.classifications.find((c) => c.id === active);

  return (
    <Page
      title="Land cover"
      subtitle="Multi-spectral classification across the area of interest."
      actions={
        <Button variant="primary" size="sm">
          <Download className="h-3.5 w-3.5" /> Export data
        </Button>
      }
    >
      {/* HUD telemetry line — same terminal-layer typography (mono, wide
          tracking, phosphor) `CoordinatesDisplay` uses on the map, in
          place of the old plain muted-grey caption row. */}
      <Readout
        className="-mt-6"
        items={[
          { label: "Location", value: result.location },
          { label: "Analyzed", value: formatDate(result.analyzedAt) },
          { label: "Total area", value: <Km2 value={TOTAL} decimals={0} /> },
        ]}
      />

      {/* ── Scene + composition. Default `stretch` (no `items-start`)
          plus `h-full` on both panels, so the scene and the composition
          box come out the same height instead of the scene's own aspect
          ratio driving a taller box than the data panel next to it. ── */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-8">
        <div className="h-full flex flex-col">
          {/* Chrome housing around the viewport — same console-body /
              inset-screen split as `EarthConsole` and the Explore map. */}
          <div className="chrome rounded-lg p-3 flex-1 flex flex-col">
            <div
              className="rounded-md overflow-hidden flex-1"
              style={{ border: IMAGE_BEZEL }}
            >
              <ImageViewport
                src="/imagery/ludhiana.jpg"
                alt="Ludhiana district — land cover classification"
                aspect="aspect-[4/3]"
                className="rounded-none h-full"
              />
            </div>
            <p className="mt-3 px-1 text-xs text-white">Ludhiana District, Punjab · Esri World Imagery</p>
          </div>
        </div>

        {/* Composition — a CRT data readout, not raw imagery, so it gets
            the terminal treatment: phosphor numbers and labels around the
            donut. The ring's own per-class colours stay untouched — they
            distinguish categories from each other, the same job the
            category dots in the breakdown below do. */}
        <div className="chrome rounded-lg p-3 h-full">
          <div
            className="crt rounded-md px-5 py-6 bg-bg-primary font-mono text-mono text-phosphor phosphor-glow h-full"
            style={{ boxShadow: SCREEN_BEZEL }}
          >
            <div
              className="relative aspect-square max-w-[19rem] mx-auto"
              role="img"
              aria-label={`Donut chart of land cover composition: ${result.classifications.map((c) => `${c.name} ${c.percentage.toFixed(1)}%`).join(", ")}`}
            >
              <Donut active={active} onHover={setActive} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-[2.75rem] leading-none font-thin tracking-[-0.015em]">
                  <Num value={focused ? focused.percentage : 100} decimals={1} suffix="%" />
                </div>
                <div className="mt-2 text-body-sm text-phosphor-dim [text-shadow:none] text-center max-w-[10rem]">
                  {focused ? focused.name : "All classes"}
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 justify-center">
              {result.classifications.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseEnter={() => setActive(c.id)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(c.id)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive(c.id)}
                  aria-pressed={active === c.id}
                  className={cn(
                    "flex items-center gap-2 text-body-sm transition-opacity duration-150",
                    active && active !== c.id ? "opacity-40" : "opacity-100"
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: brandColor(c.color) }} />
                  <span className="text-phosphor-dim [text-shadow:none]">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Breakdown — CRT terminal readout, same treatment as
          Measurements' "Saved" list and the project/report cards' text
          panels: phosphor colour + glow on the container, everything
          stepped down to `phosphor-dim` except the figures that matter. */}
      <div className="chrome rounded-lg p-3">
        <div
          className="crt rounded-md px-5 py-4 bg-bg-primary font-mono text-mono text-phosphor phosphor-glow"
          style={{ boxShadow: SCREEN_BEZEL }}
        >
          <div className="text-label uppercase text-phosphor-dim [text-shadow:none] mb-1">
            Classification breakdown
          </div>
          <div className="divide-y divide-chrome-seam/60">
            {result.classifications.map((c) => (
              <div
                key={c.id}
                onMouseEnter={() => setActive(c.id)}
                onMouseLeave={() => setActive(null)}
                onClick={() => setActive(c.id)}
                className={cn(
                  "grid grid-cols-[1fr_auto_5.5rem] items-center gap-6 py-4 transition-opacity duration-150 cursor-pointer",
                  active && active !== c.id ? "opacity-45" : "opacity-100"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: brandColor(c.color) }} />
                  <span className="text-body-sm truncate">{c.name}</span>
                </div>
                <Km2 value={c.area} decimals={0} className="text-body-sm text-phosphor-dim [text-shadow:none]" />
                <span className="text-[1.0625rem] font-medium text-right tabular">
                  <Num value={c.percentage} decimals={1} suffix="%" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Page>
  );
}
