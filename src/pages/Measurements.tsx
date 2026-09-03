import { useState } from "react";
import { Ruler, Square, Spline, Download, Trash2, MapPin, Clock } from "lucide-react";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/Button";
import { Num } from "@/components/ui/Num";
import { ImageViewport } from "@/components/ui/ImageViewport";
import { measurements } from "@/data/mockData";
import { formatTimestamp } from "@/lib/format";
import { cn, SCREEN_BEZEL, IMAGE_BEZEL } from "@/lib/utils";
import type { MeasurementType } from "@/types";

const TOOLS: { value: MeasurementType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "distance", label: "Distance", icon: Ruler },
  { value: "area", label: "Area", icon: Square },
  { value: "perimeter", label: "Perimeter", icon: Spline },
];

const HINT: Record<MeasurementType, string> = {
  distance: "Click two or more points to measure a path along the surface.",
  area: "Draw a closed polygon to measure enclosed ground area.",
  perimeter: "Draw a shape to measure the length of its boundary.",
};

/** Overlay geometry per tool, in the viewport's 0-100 space. */
function Geometry({ tool }: { tool: MeasurementType }) {
  if (tool === "distance") {
    return (
      <polyline
        points="18,72 38,54 58,58 80,30"
        fill="none"
        stroke="#6fb8ff"
        strokeWidth={0.5}
        strokeDasharray="2 1.5"
        vectorEffect="non-scaling-stroke"
      />
    );
  }
  if (tool === "area") {
    return (
      <polygon
        points="22,30 72,26 78,66 30,74"
        fill="#3d7fff"
        fillOpacity={0.18}
        stroke="#3d7fff"
        strokeWidth={0.5}
        vectorEffect="non-scaling-stroke"
      />
    );
  }
  return (
    <polygon
      points="26,34 70,28 74,64 32,70"
      fill="none"
      stroke="#91caff"
      strokeWidth={0.6}
      strokeDasharray="3 2"
      vectorEffect="non-scaling-stroke"
    />
  );
}

/**
 * Point markers for the "distance" tool — HTML `<span>`s, not SVG
 * `<circle>`s. `ImageViewport`'s overlay SVG uses `preserveAspectRatio="none"`
 * so its 0-100 coordinate space stretches non-uniformly to fill whatever
 * aspect ratio the viewport actually renders at (needed so `Box`/polygon
 * percentages land in the right place regardless of aspect) — which turns a
 * `<circle>`'s equal radius into an ellipse the moment the container isn't
 * square. Same fix `ImageViewport` already applies to its own box labels,
 * for the identical reason.
 */
function DistancePoints() {
  const points: [number, number][] = [[18, 72], [38, 54], [58, 58], [80, 30]];
  return (
    <>
      {points.map(([x, y]) => (
        <span
          key={`${x}-${y}`}
          className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-atmos ring-2 ring-bg-primary/70"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      ))}
    </>
  );
}

export default function Measurements() {
  const [tool, setTool] = useState<MeasurementType>("distance");

  return (
    <Page
      title="Measurements"
      subtitle="Distance, area and perimeter drawn straight onto the imagery."
      actions={
        <Button variant="primary" size="sm">
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      }
    >
      <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 items-start">
        <div>
          {/* Chrome toolbar — same active/inactive language as the
              Explore map's `DrawingToolbar` (this page's own tool
              selector, restyled to match rather than the generic
              pill-style `Segmented` it used before), so measuring reads
              as one console-hardware action across both screens. */}
          <div className="chrome rounded-lg p-1.5 flex flex-wrap items-center gap-1 shadow-overlay">
            {TOOLS.map((t) => {
              const Icon = t.icon;
              const active = tool === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setTool(t.value)}
                  aria-pressed={active}
                  className={cn(
                    "flex items-center gap-2 h-9 px-3.5 rounded-md text-body-sm font-medium transition-colors duration-150",
                    active
                      ? "bevel-in bg-accent-muted text-accent"
                      : "text-text-secondary hover:text-phosphor hover:bg-chrome-mid/50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
            <div className="w-px h-6 bg-chrome-seam mx-1 hidden sm:block shrink-0" aria-hidden="true" />
            {/* `flex-1 min-w-0` — this used to size to its own text and leave
                the rest of the row empty next to it. As a flex item it now
                claims whatever the buttons don't, so the row reads as one
                filled toolbar instead of three keys with a gap after them.
                Still wraps to its own full-width line under `sm`, where the
                divider above it disappears. */}
            <p className="flex-1 min-w-0 text-body-sm text-text-secondary px-2 py-1.5">{HINT[tool]}</p>
          </div>

          {/* Chrome housing around the viewport — the same console-body /
              inset-screen split as `EarthConsole` and the Explore map,
              instead of the image sitting flush with no frame around it. */}
          <div className="chrome rounded-lg p-3 mt-4">
            <div
              className="rounded-md overflow-hidden"
              style={{ border: IMAGE_BEZEL }}
            >
              <ImageViewport
                src="/imagery/kerala-coast.jpg"
                alt="Kerala coastline — measurement canvas"
                aspect="aspect-[4/3]"
                overlay={<Geometry tool={tool} />}
                className="rounded-none"
              >
                {tool === "distance" && <DistancePoints />}
              </ImageViewport>
            </div>
            <p className="mt-3 px-1 text-xs text-white">Alleppey, Kerala · Esri World Imagery</p>
          </div>
        </div>

        {/* Saved measurements — CRT terminal readout inside its own chrome
            housing, the same console-body / inset-screen split every other
            CRT panel in the app uses. This one was a bare CRT screen with
            no console around it — the steel bezel on its own read as a
            screen sitting loose, not a screen built into a console. */}
        <div className="chrome rounded-lg p-3">
          <div
            className="crt rounded-md p-5 bg-bg-primary font-mono text-mono text-phosphor phosphor-glow"
            style={{ boxShadow: SCREEN_BEZEL }}
          >
            <div className="text-label uppercase text-phosphor-dim [text-shadow:none] mb-1">Saved</div>

            <div className="divide-y divide-chrome-seam/60">
              {measurements.map((m) => (
                <div key={m.id} className="group flex items-start gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.6875rem] uppercase tracking-[0.06em] text-phosphor-dim [text-shadow:none] mb-1.5">
                      {m.type}
                    </div>
                    <div className="text-[1.75rem] leading-none font-thin tracking-[-0.012em] text-phosphor">
                      <Num value={m.value} decimals={1} />
                      <span className="ml-1.5 text-[0.9375rem] font-normal text-phosphor-dim [text-shadow:none]">
                        {m.unit}
                      </span>
                    </div>
                    <p className="mt-2.5 text-body-sm text-phosphor-dim [text-shadow:none]">{m.label}</p>
                    <p className="mt-1.5 flex items-center gap-3 text-[0.6875rem] text-phosphor-dim [text-shadow:none]">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3" />
                        {m.coordinates.length} points
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(m.createdAt)}
                      </span>
                    </p>
                  </div>
                  <button
                    aria-label={`Delete ${m.label}`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-2 rounded-md text-phosphor-dim [text-shadow:none] hover:text-danger hover:bg-bg-hover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Page>
  );
}
