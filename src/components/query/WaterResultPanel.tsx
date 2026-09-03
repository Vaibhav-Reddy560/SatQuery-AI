import { Waves, Layers } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { WaterResult } from "@/types/query";
import { Num, Km2 } from "@/components/ui/Num";
import { Badge } from "@/components/ui/Badge";
import { MapCanvas } from "@/components/map/MapCanvas";
import { formatDate } from "@/lib/format";

/**
 * NDWI water detection result panel (Phase 2C).
 *
 * Renders the complete structured water result the backend produces for a
 * real Sentinel-2 NDWI run: statistics over valid pixels, water area /
 * percentage vs the classification threshold, imagery provenance (acquisition
 * date, provider, resolution, scene id, cloud cover, processing method) and —
 * when the backend shipped a georeferenced raster — a MapLibre preview with
 * the NDWI water mask drawn as an image source. Nothing here fabricates
 * values: fields that are absent stay hidden.
 */

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-mono-sm uppercase text-phosphor-dim">{label}</div>
      <div className="mt-1.5 font-mono text-[1.375rem] font-thin leading-none text-phosphor phosphor-glow">
        <Num value={value} decimals={2} />
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 font-mono text-mono-sm uppercase text-phosphor-dim">{label}</dt>
      <dd className="min-w-0 truncate text-right font-mono text-mono-sm text-phosphor">{value}</dd>
    </div>
  );
}

export function WaterResultPanel({ result }: { result: WaterResult }) {
  const stats = result.ndwiStats;
  const imagery = result.imagery;
  const overlay = result.overlay;
  const isReal = result.mode !== "mock";

  const sourceLabel = imagery
    ? /earth search|stac/i.test(imagery.provider)
      ? "Live Sentinel-2 · Earth Search STAC"
      : "Bundled Sentinel-2 sample"
    : null;

  const modelLabel = result.model
    ? `${result.model}${result.modelVersion ? ` v${result.modelVersion}` : ""}`
    : null;

  const waterFraction =
    stats && stats.waterPixelPercentage > 0 ? stats.waterPixelPercentage : null;

  return (
    <div className="crt mt-4 overflow-hidden rounded-md border border-chrome-seam bg-bg-primary">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-chrome-seam px-4 py-3">
        <Waves className="h-4 w-4 shrink-0 text-accent" />
        <span className="font-mono text-mono-sm font-semibold uppercase tracking-[0.08em] text-phosphor">
          Water detection
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <Badge variant={isReal ? "success" : "default"}>
            {isReal ? "Real NDWI" : "Mock result"}
          </Badge>
          {sourceLabel ? (
            <Badge variant="info">{sourceLabel}</Badge>
          ) : (
            imagery && <Badge variant="accent">{imagery.satellite}</Badge>
          )}
        </span>
      </div>

      <div className="space-y-5 px-4 py-4">
        {/* ── NDWI statistics (real pixels only) ── */}
        {stats && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <Stat label="NDWI min" value={stats.min} />
            <Stat label="NDWI max" value={stats.max} />
            <Stat label="NDWI mean" value={stats.mean} />
            <Stat label="NDWI median" value={stats.median} />
          </div>
        )}

        {/* ── Water classification summary ── */}
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-mono-sm text-text-secondary">
          {waterFraction !== null && (
            <span>
              Water{" "}
              <span className="text-accent">
                <Num value={waterFraction} decimals={1} suffix="%" />
              </span>{" "}
              of valid pixels
            </span>
          )}
          {result.waterAreaKm2 > 0 && (
            <span>
              Water area{" "}
              <span className="text-accent">
                <Km2 value={result.waterAreaKm2} decimals={2} />
              </span>
            </span>
          )}
          {result.totalAreaKm2 > 0 && (
            <span>
              Analysed area{" "}
              <span className="text-phosphor">
                <Km2 value={result.totalAreaKm2} decimals={2} />
              </span>
            </span>
          )}
          <span>
            Threshold NDWI ≥{" "}
            <span className="text-phosphor">
              <Num value={result.threshold} decimals={1} />
            </span>
          </span>
          {stats && (
            <span>
              Valid pixels{" "}
              <span className="text-phosphor">
                <Num value={stats.validPixelPercentage} decimals={0} suffix="%" />
              </span>
            </span>
          )}
        </div>

        {/* ── Raster overlay on the existing MapLibre map ── */}
        {overlay && (
          <div className="overflow-hidden rounded-md border border-chrome-seam">
            <div className="flex items-center gap-2 border-b border-chrome-seam bg-bg-secondary/60 px-3 py-2">
              <Layers className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="font-mono text-mono-sm uppercase text-phosphor-dim">
                Raster overlay
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

        {/* ── Imagery provenance ── */}
        {imagery && (
          <dl className="space-y-1.5 border-t border-chrome-seam pt-4">
            <div className="mb-1.5 font-mono text-mono-sm uppercase text-phosphor-dim">
              Imagery
            </div>
            <MetaRow
              label="Acquired"
              value={imagery.acquisitionDate ? formatDate(imagery.acquisitionDate) : "—"}
            />
            <MetaRow label="Scene" value={imagery.sceneId ?? "—"} />
            <MetaRow
              label="Satellite"
              value={`${imagery.satellite}${imagery.sensor ? ` · ${imagery.sensor}` : ""}`}
            />
            <MetaRow
              label="Resolution"
              value={imagery.resolutionM ? <Num value={imagery.resolutionM} decimals={0} suffix=" m" /> : "—"}
            />
            <MetaRow
              label="Cloud cover"
              value={
                imagery.cloudCoverPercent !== undefined ? (
                  <Num value={imagery.cloudCoverPercent} decimals={1} suffix="%" />
                ) : (
                  "—"
                )
              }
            />
            <MetaRow label="CRS" value={imagery.crs ?? "—"} />
            <MetaRow label="Bands" value={imagery.bands.length > 0 ? imagery.bands.join(", ") : "—"} />
            {modelLabel && <MetaRow label="Algorithm" value={modelLabel} />}
            {imagery.processingMethod && (
              <p className="pt-1 font-mono text-mono-sm leading-relaxed text-text-muted">
                {imagery.processingMethod}
              </p>
            )}
          </dl>
        )}
      </div>
    </div>
  );
}