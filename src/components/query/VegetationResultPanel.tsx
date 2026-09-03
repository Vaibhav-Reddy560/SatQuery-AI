import { TreePine, Layers } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { VegetationResult, VegetationZone } from "@/types/query";
import { Num, Km2 } from "@/components/ui/Num";
import { Badge } from "@/components/ui/Badge";
import { MapCanvas } from "@/components/map/MapCanvas";
import { formatDate } from "@/lib/format";

/**
 * NDVI analysis result panel (Phase 2B).
 *
 * Renders the complete structured vegetation result the backend produces for
 * a real Sentinel-2 NDVI run: statistics over valid pixels, health-class
 * zone areas, imagery provenance (acquisition date, provider, resolution,
 * scene id, cloud cover, processing method), and — when the backend shipped a
 * georeferenced raster — a MapLibre preview with the NDVI overlay drawn as an
 * image source. Nothing here fabricates values: fields that are absent stay
 * hidden, so a future mock/partial result degrades gracefully.
 */

const ZONE_META: Record<VegetationZone["status"], { label: string; color: string }> = {
  healthy: { label: "Healthy", color: "#22c55e" },
  stressed: { label: "Stressed", color: "#f59e0b" },
  degraded: { label: "Degraded", color: "#ef4444" },
  loss: { label: "Low / no vegetation", color: "#a16207" },
};

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

export function VegetationResultPanel({ result }: { result: VegetationResult }) {
  const stats = result.ndviStats;
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

  return (
    <div className="crt mt-4 overflow-hidden rounded-md border border-chrome-seam bg-bg-primary">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-chrome-seam px-4 py-3">
        <TreePine className="h-4 w-4 shrink-0 text-success" />
        <span className="font-mono text-mono-sm font-semibold uppercase tracking-[0.08em] text-phosphor">
          NDVI analysis
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <Badge variant={isReal ? "success" : "default"}>
            {isReal ? "Real NDVI" : "Mock result"}
          </Badge>
          {sourceLabel ? (
            <Badge variant="info">{sourceLabel}</Badge>
          ) : (
            imagery && <Badge variant="accent">{imagery.satellite}</Badge>
          )}
        </span>
      </div>

      <div className="space-y-5 px-4 py-4">
        {/* ── NDVI statistics (real pixels only) ── */}
        {stats && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <Stat label="NDVI min" value={stats.min} />
            <Stat label="NDVI max" value={stats.max} />
            <Stat label="NDVI mean" value={stats.mean} />
            <Stat label="NDVI median" value={stats.median} />
          </div>
        )}

        {/* ── Coverage summary ── */}
        {(stats || result.totalAreaKm2 > 0) && (
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-mono-sm text-text-secondary">
            {stats && (
              <span>
                Valid pixels{" "}
                <span className="text-phosphor">
                  <Num value={stats.validPixelPercentage} decimals={0} suffix="%" />
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
            {result.vegetationLostKm2 !== undefined && result.vegetationLostKm2 > 0 && (
              <span>
                Vegetation lost{" "}
                <span className="text-phosphor">
                  <Km2 value={result.vegetationLostKm2} decimals={2} />
                </span>
              </span>
            )}
          </div>
        )}

        {/* ── Health-class zones ── */}
        {result.zones.length > 0 && (
          <div className="space-y-2">
            <div className="font-mono text-mono-sm uppercase text-phosphor-dim">
              Vegetation zones
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-4">
              {result.zones.map((z) => (
                <div key={z.id} className="flex items-baseline justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 font-mono text-mono-sm text-text-secondary">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: ZONE_META[z.status].color }}
                    />
                    <span className="truncate">{ZONE_META[z.status].label}</span>
                  </span>
                  <span className="shrink-0 font-mono text-mono-sm text-phosphor">
                    <Km2 value={z.areaKm2} decimals={1} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

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