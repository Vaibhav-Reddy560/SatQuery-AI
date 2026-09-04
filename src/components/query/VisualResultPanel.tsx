import { Eye, ImageOff, ScanLine } from "lucide-react";
import type { VisualResult } from "@/types/query";
import { Num } from "@/components/ui/Num";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";

/**
 * Visual interpretation result panel (Phase 2G / 3B).
 *
 * Renders a REAL vision-language analysis: the backend-supplied true-colour
 * RGB preview (rendered from actual Sentinel-2 B04/B03/B02 pixels), the
 * model's actual answer verbatim, imagery provenance, and runtime metadata
 * (latency, device, image dimensions). Nothing here fabricates values:
 * a VLM has no calibrated confidence, so no confidence is ever displayed, and
 * the RGB preview is only shown when the backend actually returned one.
 */

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 font-mono text-mono-sm uppercase text-phosphor-dim">{label}</dt>
      <dd className="min-w-0 truncate text-right font-mono text-mono-sm text-phosphor">{value}</dd>
    </div>
  );
}

export function VisualResultPanel({ result }: { result: VisualResult }) {
  const imagery = result.imagery;

  const modelLabel = result.model
    ? `${result.model}${result.modelVersion ? ` v${result.modelVersion}` : ""}`
    : null;

  const latencySeconds =
    result.inferenceLatencyMs !== undefined
      ? (result.inferenceLatencyMs / 1000).toFixed(1)
      : null;

  const sourceLabel = imagery
    ? /earth search|stac/i.test(imagery.provider)
      ? "Live Sentinel-2 · Earth Search STAC"
      : "Bundled Sentinel-2 sample"
    : null;

  return (
    <div className="crt mt-4 overflow-hidden rounded-md border border-chrome-seam bg-bg-primary">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-chrome-seam px-4 py-3">
        <Eye className="h-4 w-4 shrink-0 text-accent" />
        <span className="font-mono text-mono-sm font-semibold uppercase tracking-[0.08em] text-phosphor">
          Visual interpretation
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <Badge variant="success">Real VLM</Badge>
          {sourceLabel ? (
            <Badge variant="info">{sourceLabel}</Badge>
          ) : (
            imagery && <Badge variant="accent">{imagery.satellite}</Badge>
          )}
        </span>
      </div>

      <div className="space-y-5 px-4 py-4">
        {/* ── Real RGB preview (backend-rendered from real Sentinel-2 bands) ── */}
        {result.imageDataUrl ? (
          <div className="overflow-hidden rounded-md border border-chrome-seam">
            <div className="flex items-center gap-2 border-b border-chrome-seam bg-bg-secondary/60 px-3 py-2">
              <ScanLine className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="font-mono text-mono-sm uppercase text-phosphor-dim">
                Analysed scene
              </span>
              <span className="ml-auto min-w-0 truncate font-mono text-mono-sm text-text-muted">
                True-colour RGB from real Sentinel-2 bands
              </span>
            </div>
            <img
              src={result.imageDataUrl}
              alt={`True-colour Sentinel-2 RGB preview analysed by ${result.model ?? "the vision-language model"}`}
              className="block h-auto w-full bg-bg-secondary"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-chrome-seam bg-bg-secondary/60 px-3 py-2.5 font-mono text-mono-sm text-text-muted">
            <ImageOff className="h-4 w-4 shrink-0" />
            RGB preview unavailable — the backend did not return an image for
            this result.
          </div>
        )}

        {/* ── VLM answer (verbatim model output) ── */}
        {result.answer && (
          <div className="rounded-md border border-chrome-seam bg-bg-secondary/40 px-4 py-3">
            <div className="mb-1.5 font-mono text-mono-sm uppercase text-phosphor-dim">
              Model answer
            </div>
            <p className="text-body leading-relaxed text-text-primary">{result.answer}</p>
          </div>
        )}

        {/* ── Honesty note: real VLM, not a measurement ── */}
        <p className="font-mono text-mono-sm leading-relaxed text-text-muted">
          This is general visual interpretation by a real vision-language model
          that received the actual image pixels — it is not a calibrated
          remote-sensing measurement, so no confidence score is reported. For
          quantitative answers use the dedicated analysis tools.
        </p>

        {/* ── Imagery provenance (backend-provided only) ── */}
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
            <MetaRow label="Provider" value={imagery.provider} />
            <MetaRow label="CRS" value={imagery.crs ?? "—"} />
            {imagery.processingMethod && (
              <p className="pt-1 font-mono text-mono-sm leading-relaxed text-text-muted">
                {imagery.processingMethod}
              </p>
            )}
          </dl>
        )}

        {/* ── Model + runtime metadata ── */}
        {(modelLabel || latencySeconds || result.device || result.imageSize) && (
          <dl className="space-y-1.5 border-t border-chrome-seam pt-4">
            <div className="mb-1.5 font-mono text-mono-sm uppercase text-phosphor-dim">
              Model &amp; runtime
            </div>
            {modelLabel && <MetaRow label="Model" value={modelLabel} />}
            {latencySeconds && <MetaRow label="Inference" value={`${latencySeconds} s`} />}
            {result.device && <MetaRow label="Device" value={result.device} />}
            {result.imageSize && <MetaRow label="Image size" value={result.imageSize} />}
          </dl>
        )}
      </div>
    </div>
  );
}