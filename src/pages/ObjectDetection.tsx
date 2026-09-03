import { useMemo, useState } from "react";
import { Download, RefreshCw, Upload } from "lucide-react";
import { Page } from "@/components/layout/Page";
import { AssistantPanel } from "@/components/ai/AssistantPanel";
import { Button } from "@/components/ui/Button";
import { objectDetectionAssistant } from "@/services/pageAssistants";
import { Num } from "@/components/ui/Num";
import { ImageViewport, type Box } from "@/components/ui/ImageViewport";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { objectDetectionResult } from "@/data/mockData";
import { brandColor } from "@/lib/palette";
import { cn, SCREEN_BEZEL, IMAGE_BEZEL } from "@/lib/utils";

const result = objectDetectionResult;

/**
 * Detected objects laid out over the real Navi Mumbai scene. Positions are in
 * 0-100 space so boxes and labels scale with the image.
 */
const LAYOUT: Record<string, { x: number; y: number; w: number; h: number }> = {
  "obj-1": { x: 12, y: 18, w: 15, h: 11 },
  "obj-2": { x: 34, y: 12, w: 11, h: 9 },
  "obj-3": { x: 58, y: 24, w: 13, h: 15 },
  "obj-4": { x: 20, y: 46, w: 9, h: 8 },
  "obj-5": { x: 44, y: 52, w: 17, h: 12 },
  "obj-6": { x: 70, y: 58, w: 12, h: 10 },
  "obj-7": { x: 15, y: 68, w: 14, h: 9 },
  "obj-8": { x: 52, y: 74, w: 10, h: 8 },
};

export default function ObjectDetection() {
  const [active, setActive] = useState<string | null>(null);

  const objects = useMemo(
    () => (active ? result.detectedObjects.filter((o) => o.category === active) : result.detectedObjects),
    [active]
  );

  const boxes: Box[] = useMemo(
    () =>
      objects
        .filter((o) => LAYOUT[o.id])
        .map((o) => ({
          id: o.id,
          ...LAYOUT[o.id],
          label: `${o.label} · ${Math.round(o.confidence * 100)}%`,
          color: brandColor(result.categories.find((c) => c.name === o.category)?.color),
        })),
    [objects]
  );

  return (
    <Page
      title="Object detection"
      subtitle="Buildings, vehicles, vessels and infrastructure grounded to the pixel."
      actions={
        <>
          {/* Same hand-rolled `bevel` + `bg-bg-hover` treatment as the nav
              bar's Search/Notifications/Account controls, instead of the
              `chrome` variant's corner-bracket + pulsing LED — these are
              page-level utility actions, not the console shell itself. */}
          <button className="bevel flex items-center gap-2 h-9 px-4 rounded-md bg-bg-hover text-body-sm font-medium text-text-secondary transition-colors duration-150 hover:bg-bg-hover/70 hover:text-text-primary">
            <Upload className="h-3.5 w-3.5" /> Upload
          </button>
          <button className="bevel flex items-center gap-2 h-9 px-4 rounded-md bg-bg-hover text-body-sm font-medium text-text-secondary transition-colors duration-150 hover:bg-bg-hover/70 hover:text-text-primary">
            <RefreshCw className="h-3.5 w-3.5" /> Re-run
          </button>
          <Button variant="primary" size="sm"><Download className="h-3.5 w-3.5" /> Export</Button>
        </>
      }
    >
      {/* ── Headline + scene. `items-start` used to let each column size
          to its own content — the scene (aspect-ratio driven) always came
          out taller than the count+filter panel, leaving the right box
          visibly shorter. Default `stretch` (no `items-*` override) makes
          the grid row height follow the taller column, and both panels
          are `h-full` so they actually fill it instead of leaving a gap
          at the bottom of the shorter one. ── */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-8">
        <div className="h-full flex flex-col">
          {/* Chrome housing around the viewport — same console-body /
              inset-screen split as `EarthConsole`, the Explore map, and
              every other analysis page's imagery panel now uses. */}
          <div className="chrome rounded-lg p-3 flex-1 flex flex-col">
            <div
              className="rounded-md overflow-hidden flex-1"
              style={{ border: IMAGE_BEZEL }}
            >
              <ImageViewport
                src="/imagery/navi-mumbai.jpg"
                alt="Navi Mumbai — object detection"
                boxes={boxes}
                aspect="aspect-[16/10]"
                className="rounded-none h-full"
              />
            </div>
            <p className="mt-3 px-1 text-xs text-white">
              {result.imageName} · Esri World Imagery · {result.categories.length} categories
            </p>
          </div>
        </div>

        {/* Count + category filter — a CRT data readout (these are
            instrument-derived counts, not raw imagery), same treatment
            `LandCover`'s composition panel and `ChangeDetection`'s
            statistics panel both use. Category filters get the `bevel`
            hardware-button language instead of soft pill chips, matching
            the sidebar's own nav items and the console-button convention
            used everywhere else a control lives on a chrome surface. */}
        <div className="chrome rounded-lg p-3 h-full">
          <div
            className="crt rounded-md px-5 py-5 bg-bg-primary font-mono text-mono text-phosphor phosphor-glow h-full"
            style={{ boxShadow: SCREEN_BEZEL }}
          >
            <div className="text-[0.6875rem] uppercase tracking-[0.06em] text-phosphor-dim [text-shadow:none] mb-3">
              Detected
            </div>
            <div className="text-[3.5rem] leading-none font-thin tracking-[-0.015em]">
              <Num value={active ? objects.length : result.totalObjects} animate />
            </div>
            <p className="mt-3 text-body-sm text-phosphor-dim [text-shadow:none]">
              {active ? `in ${active}` : "objects across all categories"}
            </p>

            {/* No button chrome here — just text, colour, and a hover/
                active state. A wrapped row of pills lined up raggedly
                (different label widths meant the grid never actually
                aligned); a plain vertical list with the count right-
                aligned reads as properly positioned instead. */}
            <div className="mt-8 pt-6 border-t border-chrome-seam">
              <div className="text-[0.6875rem] uppercase tracking-[0.06em] text-phosphor-dim [text-shadow:none] mb-1">
                Categories
              </div>
              <div>
                <button
                  onClick={() => setActive(null)}
                  className={cn(
                    "flex w-full items-center rounded-md py-2 text-[0.8125rem] font-medium transition-colors duration-150",
                    active === null ? "text-accent" : "text-phosphor-dim [text-shadow:none] hover:text-phosphor"
                  )}
                >
                  All
                </button>
                {result.categories.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setActive(active === c.name ? null : c.name)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-md py-2 text-[0.8125rem] font-medium transition-colors duration-150",
                      active === c.name ? "text-accent" : "text-phosphor-dim [text-shadow:none] hover:text-phosphor"
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: brandColor(c.color) }}
                      />
                      {c.name}
                    </span>
                    <span className="opacity-60">{c.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Detections — a terminal log, not a plain list. Chrome housing
          added around it, matching every other analysis page's data
          panel, without changing the log itself. ── */}
      <div className="chrome rounded-lg p-3">
        <div
          className="crt rounded-md px-5 py-4 bg-bg-primary font-mono text-mono text-phosphor phosphor-glow"
          style={{ boxShadow: SCREEN_BEZEL }}
        >
          <div className="flex items-baseline justify-between gap-4 mb-1">
            <div className="text-label uppercase text-phosphor-dim [text-shadow:none]">Detections</div>
            <div className="text-[0.6875rem] text-phosphor-dim [text-shadow:none]">{objects.length} shown</div>
          </div>
          <div className="divide-y divide-chrome-seam/60">
            {objects.map((o) => (
              <div
                key={o.id}
                className="flex flex-col gap-2 py-3.5 sm:grid sm:grid-cols-[1fr_7rem_9rem] sm:items-center sm:gap-4 sm:gap-x-6"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: brandColor(result.categories.find((c) => c.name === o.category)?.color) }}
                  />
                  <span className="truncate text-body-sm">{o.label}</span>
                </div>
                <span className="pl-5 text-[0.6875rem] uppercase text-phosphor-dim [text-shadow:none] sm:pl-0">
                  {o.category}
                </span>
                <ConfidenceBar value={o.confidence} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <AssistantPanel {...objectDetectionAssistant} />
    </Page>
  );
}
