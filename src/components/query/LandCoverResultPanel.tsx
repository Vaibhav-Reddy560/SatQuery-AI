import { Map as MapIcon, Layers, BrainCircuit } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { LandCoverResult } from "@/types/query";
import { Num, Km2 } from "@/components/ui/Num";
import { Badge } from "@/components/ui/Badge";
import { MapCanvas } from "@/components/map/MapCanvas";
import { formatDate } from "@/lib/format";

/**
 * Land-cover classification result panel (Phase 2D).
 *
 * Renders the complete structured land-cover result the backend produces for
 * a real trained-ML classification run: class breakdown with the exact legend
 * colours used in the raster overlay, honest model identity (name, version,
 * inputs, measured confidence — clearly stamped as ML, never conflated with
 * the NDVI/NDWI algorithms), imagery provenance, and — when the backend
 * shipped a georeferenced categorical raster — a MapLibre preview with the
 * classification overlay drawn as an image source. Nothing here fabricates
 * values: fields that are absent stay hidden, so a future mock/partial
 * result degrades gracefully.
 */

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 font-mono text-mono-sm uppercase text-phosphor-dim">{label}</dt>
      <dd className="min-w-0 truncate text-right font-mono text-mono-sm text-phosphor">{value}</dd>
    </div>
  );
}

export function LandCoverResultPanel({ result }: { result: LandCoverResult }) {
  const imagery = result.imagery;
  const overlay = result.overlay;
  const isReal = result.mode !== "mock";
  const isML = result.modelKind === "ml";

  const sourceLabel = imagery
    ? /earth search|stac/i.test(imagery.provider)
      ? "Live Sentinel-2 · Earth Search STAC"
      : "Bundled Sentinel-2 sample"
    : null;

  const modelLabel = result.model
    ? `${result.model}${result.modelVersion ? ` v${result.modelVersion}` : ""}`
    : null;

  const sorted = [...result.classes].sort((a, b) => b.percentage - a.percentage);

  return (
    <div className="crt mt-4 overflow-hidden rounded-md border border-chrome-seam bg-bg-primary">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-chrome-seam px-4 py-3">
        <MapIcon className="h-4 w-4 shrink-0 text-accent" />
        <span className="font-mono text-mono-sm font-semibold uppercase tracking-[0.08em] text-phosphor">
          Land cover classification
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <Badge variant={isReal ? "success" : "default"}>
            {isReal ? (isML ? "Real ML classification" : "Real classification") : "Mock result"}
          </Badge>
          {sourceLabel ? (
            <Badge variant="info">{sourceLabel}</Badge>
          ) : (
            imagery && <Badge variant="accent">{imagery.satellite}</Badge>
          )}
        </span>
      </div>

      <div className="space-y-5 px-4 py-4">
        {/* ── Coverage summary ── */}
        {(result.totalAreaKm2 > 0 || result.confidence > 0) && (
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-mono-sm text-text-secondary">
            {result.totalAreaKm2 > 0 && (
              <span>
                Classified area{" "}
                <span className="text-phosphor">
                  <Km2 value={result.totalAreaKm2} decimals={2} />
                </span>
              </span>
            )}
            {result.confidence > 0 && (
              <span>
                Measured balanced accuracy{" "}
                <span className="text-accent">
                  <Num value={result.confidence} decimals={2} />
                </span>
              </span>
            )}
            {result.modelInputs && result.modelInputs.length > 0 && (
              <span className="min-w-0 truncate">
                Inputs{" "}
                <span className="text-phosphor">{result.modelInputs.join(" + ")}</span>
              </span>
            )}
          </div>
        )}

        {/* ── Class breakdown with legend (colors = overlay palette) ── */}
        {sorted.length > 0 && (
          <div className="space-y-2">
            <div className="font-mono text-mono-sm uppercase text-phosphor-dim">
              Detected classes
            </div>
            <div className="space-y-1.5">
              {sorted.map((c) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-sm border border-chrome-seam"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-mono-sm text-text-secondary">
                    {c.name}
                  </span>
                  <span className="shrink-0 font-mono text-mono-sm text-phosphor">
                    <Num value={c.percentage} decimals={1} suffix="%" />
                  </span>
                  <span className="w-24 shrink-0 text-right font-mono text-mono-sm text-text-muted">
                    <Km2 value={c.areaKm2} decimals={2} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Model identity (honest ML, never conflated with algorithms) ── */}
        {modelLabel && (
          <div className="flex items-start gap-2 rounded-md border border-chrome-seam bg-bg-secondary/40 px-3 py-2.5">
            <BrainCircuit className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <div className="min-w-0">
              <div className="font-mono text-mono-sm uppercase text-phosphor-dim">
                {isML ? "Model" : "Processing method"}
              </div>
              <div className="truncate font-mono text-mono-sm text-phosphor">{modelLabel}</div>
              {isML && (
                <p className="mt-1 font-mono text-mono-sm leading-relaxed text-text-muted">
                  Trained on open ESA WorldCover 2021 labels + Sentinel-2 L2A
                  reflectance. Random forest, CPU-only, deterministic.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Raster overlay on the existing MapLibre map ── */}
        {overlay && (
          <div className="overflow-hidden rounded-md border border-chrome-seam">
            <div className="flex items-center gap-2 border-b border-chrome-seam bg-bg-secondary/60 px-3 py-2">
              <Layers className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="font-mono text-mono-sm uppercase text-phosphor-dim">
                Classification overlay
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