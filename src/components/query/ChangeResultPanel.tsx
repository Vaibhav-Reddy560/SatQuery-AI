import { History, Layers } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { ChangeResult } from "@/types/query";
import { Num, Km2 } from "@/components/ui/Num";
import { Badge } from "@/components/ui/Badge";
import { MapCanvas } from "@/components/map/MapCanvas";
import { formatDate } from "@/lib/format";

/**
 * Multi-temporal change-detection result panel (Phase 2E).
 *
 * Renders the complete structured bi-temporal result the backend produces
 * for a real delta-NDVI run over two Sentinel-2 observations: the exact
 * before/after observations compared (dates + scene ids), change statistics
 * over pixels valid in BOTH dates, the explicit threshold and method, the
 * change legend (unchanged / vegetation loss / vegetation gain — colors from
 * the same mapping as the raster), and — when the backend shipped a
 * georeferenced change raster — a MapLibre preview with the change overlay
 * drawn as an image source. Nothing here fabricates values: fields that are
 * absent stay hidden, so a future mock/partial result degrades gracefully.
 */

const CLASS_META: { label: string; color: string }[] = [
  { label: "Vegetation loss", color: "#dc2626" },
  { label: "Unchanged", color: "#6b7280" },
  { label: "Vegetation gain", color: "#22c55e" },
];

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-mono-sm uppercase text-phosphor-dim">{label}</div>
      <div className="mt-1.5 font-mono text-[1.375rem] font-thin leading-none text-phosphor phosphor-glow">
        <Num value={value} decimals={1} suffix="%" />
      </div>
    </div>
  );
}

function ObservationBlock({
  role,
  imagery,
  date,
  sceneId,
}: {
  role: string;
  imagery?: ChangeResult["beforeImagery"];
  date: string;
  sceneId?: string;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-md border border-chrome-seam bg-bg-secondary/40 px-3 py-2.5">
      <div className="font-mono text-mono-sm uppercase text-phosphor-dim">{role}</div>
      <div className="mt-0.5 truncate font-mono text-mono-sm text-phosphor">
        {date ? formatDate(date) : "—"}
      </div>
      <div className="truncate font-mono text-mono-xs text-text-muted">{sceneId ?? "—"}</div>
      {imagery && imagery.cloudCoverPercent !== undefined && (
        <div className="mt-1 font-mono text-mono-xs text-text-muted">
          Cloud <Num value={imagery.cloudCoverPercent} decimals={1} suffix="%" />
          {imagery.resolutionM ? (
            <>
              {" · "}
              <Num value={imagery.resolutionM} decimals={0} suffix=" m" />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function ChangeResultPanel({ result }: { result: ChangeResult }) {
  const stats = result.changeStats;
  const before = result.beforeImagery;
  const after = result.afterImagery;
  const overlay = result.overlay;
  const isReal = result.mode !== "mock";

  const sourceLabel = before
    ? /earth search|stac/i.test(before.provider)
      ? "Live Sentinel-2 · Earth Search STAC"
      : "Bundled Sentinel-2 pair"
    : null;

  const methodLabel = result.changeMethod
    ? `${result.changeMethod}${result.modelVersion ? ` v${result.modelVersion}` : ""}`
    : null;

  return (
    <div className="crt mt-4 overflow-hidden rounded-md border border-chrome-seam bg-bg-primary">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-chrome-seam px-4 py-3">
        <History className="h-4 w-4 shrink-0 text-accent" />
        <span className="font-mono text-mono-sm font-semibold uppercase tracking-[0.08em] text-phosphor">
          Change detection
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <Badge variant={isReal ? "success" : "default"}>
            {isReal ? "Real ΔNDVI" : "Mock result"}
          </Badge>
          {sourceLabel ? (
            <Badge variant="info">{sourceLabel}</Badge>
          ) : (
            before && <Badge variant="accent">{before.satellite}</Badge>
          )}
        </span>
      </div>

      <div className="space-y-5 px-4 py-4">
        {/* ── The two observations compared ── */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <ObservationBlock
            role="Before"
            imagery={before}
            date={result.beforeDate}
            sceneId={before?.sceneId}
          />
          <div className="flex items-center justify-center font-mono text-mono-sm text-phosphor-dim">
            →
          </div>
          <ObservationBlock
            role="After"
            imagery={after}
            date={result.afterDate}
            sceneId={after?.sceneId}
          />
        </div>

        {/* ── Change statistics (pixels valid in both dates) ── */}
        {stats && (
          <>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <Stat label="Changed" value={stats.changedPercentage} />
              <Stat label="Vegetation loss" value={stats.lossPercentage} />
              <Stat label="Vegetation gain" value={stats.gainPercentage} />
              <Stat label="Unchanged" value={stats.unchangedPercentage} />
            </div>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-mono-sm text-text-secondary">
              <span>
                Compared area{" "}
                <span className="text-phosphor">
                  <Km2 value={stats.totalAreaKm2} decimals={2} />
                </span>
              </span>
              <span>
                Changed area{" "}
                <span className="text-accent">
                  <Km2 value={stats.changedAreaKm2} decimals={2} />
                </span>
              </span>
              {stats.lossAreaKm2 > 0 && (
                <span>
                  Loss{" "}
                  <span className="text-phosphor">
                    <Km2 value={stats.lossAreaKm2} decimals={2} />
                  </span>
                </span>
              )}
              {stats.gainAreaKm2 > 0 && (
                <span>
                  Gain{" "}
                  <span className="text-phosphor">
                    <Km2 value={stats.gainAreaKm2} decimals={2} />
                  </span>
                </span>
              )}
              <span>
                Valid pixels{" "}
                <span className="text-phosphor">
                  <Num value={stats.validPixelCount} decimals={0} />
                </span>
              </span>
              {result.threshold !== undefined && (
                <span>
                  Threshold |ΔNDVI| ≥{" "}
                  <span className="text-phosphor">
                    <Num value={result.threshold} decimals={2} />
                  </span>
                </span>
              )}
            </div>
          </>
        )}

        {/* ── Change legend (colors = overlay palette) ── */}
        {stats && (
          <div className="space-y-1.5">
            <div className="font-mono text-mono-sm uppercase text-phosphor-dim">
              Change classes
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-3">
              {CLASS_META.map((c) => (
                <div key={c.label} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-sm border border-chrome-seam"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="font-mono text-mono-sm text-text-secondary">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Method identity (radiometric, never ML) ── */}
        {methodLabel && (
          <div className="rounded-md border border-chrome-seam bg-bg-secondary/40 px-3 py-2.5">
            <div className="font-mono text-mono-sm uppercase text-phosphor-dim">
              Method
            </div>
            <div className="font-mono text-mono-sm text-phosphor">{methodLabel}</div>
            <p className="mt-1 font-mono text-mono-sm leading-relaxed text-text-muted">
              delta NDVI = NDVI_after − NDVI_before over SCL cloud-masked
              pixels valid in both observations. Deterministic radiometric
              algorithm — not ML. Spectral differences also reflect seasonal /
              agricultural variation, so not every changed pixel is real
              land-use change.
            </p>
          </div>
        )}

        {/* ── Raster overlay on the existing MapLibre map ── */}
        {overlay && (
          <div className="overflow-hidden rounded-md border border-chrome-seam">
            <div className="flex items-center gap-2 border-b border-chrome-seam bg-bg-secondary/60 px-3 py-2">
              <Layers className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="font-mono text-mono-sm uppercase text-phosphor-dim">
                Change overlay
              </span>
              <span className="ml-auto min-w-0 truncate font-mono text-mono-sm text-text-muted">
                {overlay.label}
              </span>
            </div>
            <div className="relative h-56">
              <MapCanvas
                center={{
                  lat: (overlay.bounds[1] + overlay.bounds[3]) / 2,
                  lng: (overlay.bounds[0] + overlay.bounds[2]) / 2,
                }}
                zoom={13}
                overlay={overlay}
                onMapReady={(map: MapLibreMap) =>
                  map.fitBounds(
                    [
                      [overlay.bounds[0], overlay.bounds[1]],
                      [overlay.bounds[2], overlay.bounds[3]],
                    ],
                    { padding: 20, duration: 0 }
                  )
                }
                className="h-full w-full"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}