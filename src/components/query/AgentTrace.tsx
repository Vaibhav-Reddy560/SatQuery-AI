import { useState } from "react";
import { ChevronRight, Cpu, Crosshair, MapPin, Gauge } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { QueryResponse } from "@/types/query";
import { getToolById } from "@/services/analysisTools";
import { intentLabel } from "@/services/queryParser";
import { Num } from "@/components/ui/Num";
import { cn } from "@/lib/utils";
import { ease, dur } from "@/lib/motion";

/**
 * Auditable execution trace: which intent was parsed, which tool was selected,
 * with what parameters, and how confident the parse was.
 *
 * Problem statement 26167 lists this explicitly under the evaluation criteria,
 * and it was surfaced nowhere in the UI before.
 *
 * v5: rebuilt as an ASCII-boxed log — terminal is the text-output layer's
 * material, and a "why did the agent do this" trace reads exactly like a
 * diagnostic printout. Dot-leaders (`label ..... value`) are the classic
 * fixed-width-terminal alignment trick; on a proportional font they'd need a
 * real table, but on JetBrains Mono a `flex-1` span filled with `.` and
 * `overflow: hidden` does the job with no measurement.
 */

const DOTS = ".".repeat(160);

function Leader() {
  return (
    <span aria-hidden="true" className="mx-2 flex-1 overflow-hidden whitespace-nowrap text-phosphor-dim/40">
      {DOTS}
    </span>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0 translate-y-[0.15em] text-phosphor-dim" />
      <dt className="shrink-0 text-phosphor-dim">{label}</dt>
      <Leader />
      <dd className="max-w-[60%] shrink-0 truncate text-phosphor">{value}</dd>
    </div>
  );
}

export function AgentTrace({ response }: { response: QueryResponse }) {
  const [open, setOpen] = useState(false);
  const tool = getToolById(response.result.toolId);

  const rows = [
    { icon: Crosshair, label: "INTENT", value: intentLabel(response.intent.type) },
    { icon: Cpu, label: "TOOL", value: tool?.name ?? response.result.toolId },
    { icon: MapPin, label: "LOCATION", value: response.intent.location ?? response.result.location },
    {
      icon: Gauge,
      label: "CENTRE",
      value: `${response.intent.centre.lat.toFixed(3)}°, ${response.intent.centre.lng.toFixed(3)}°`,
    },
  ];

  return (
    <div className="crt mt-4 overflow-hidden rounded-md border border-chrome-seam bg-bg-primary">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="relative flex h-10 w-full items-center gap-2.5 px-4 text-left font-mono text-mono-sm uppercase text-phosphor"
      >
        <ChevronRight
          className={cn("h-3.5 w-3.5 text-phosphor-dim transition-transform duration-200", open && "rotate-90")}
        />
        <span>Execution trace</span>
        <span className="ml-auto text-phosphor-dim">
          <Num value={response.processingTimeMs} suffix=" ms" />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: dur.base, ease: ease.apple }}
            className="relative overflow-hidden"
          >
            <dl className="space-y-2 px-4 pb-4 font-mono text-mono-sm">
              {rows.map((r) => (
                <Row key={r.label} icon={r.icon} label={r.label} value={r.value} />
              ))}
              <div className="flex items-baseline gap-2 pt-0.5">
                <span className="h-3.5 w-3.5 shrink-0" />
                <dt className="shrink-0 text-phosphor-dim">CONFIDENCE</dt>
                <Leader />
                <dd className="shrink-0 text-phosphor">
                  <Num value={Math.round(response.intent.confidence * 100)} suffix="%" />
                </dd>
              </div>
              {response.trace && response.trace.length > 0 && (
                <div className="mt-3 border-t border-chrome-seam pt-3">
                  <div className="mb-1.5 text-[0.6875rem] uppercase text-phosphor-dim">Agent steps</div>
                  <ol className="space-y-1 text-phosphor-dim">
                    {response.trace.map((step, i) => (
                      <li key={i} className="flex gap-2">
                        <span aria-hidden="true" className="shrink-0 text-phosphor-dim/50">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
