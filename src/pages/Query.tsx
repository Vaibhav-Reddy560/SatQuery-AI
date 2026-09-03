import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUp, Copy, ThumbsDown, ThumbsUp, Image as ImageIcon, Map as MapIcon, BarChart3 } from "lucide-react";
import { LogoMark } from "@/components/brand/LogoMark";
import { Markdown } from "@/components/query/Markdown";
import { AgentTrace } from "@/components/query/AgentTrace";
import { VegetationResultPanel } from "@/components/query/VegetationResultPanel";
import { WaterResultPanel } from "@/components/query/WaterResultPanel";
import { LandCoverResultPanel } from "@/components/query/LandCoverResultPanel";
import { ChangeResultPanel } from "@/components/query/ChangeResultPanel";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { BorderBeam } from "@/components/ui/BorderBeam";
import { ScanSweep } from "@/components/ui/ScanSweep";
import { EarthFallback } from "@/components/hero/EarthFallback";
import { queryMessages } from "@/data/mockData";
import { processQueryAsync } from "@/services/queryEngine";
import { intentLabel } from "@/services/queryParser";
import { useAppStore } from "@/store/useAppStore";
import { formatTime } from "@/lib/format";
import { ease, dur, scrollBehavior } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { QueryMessage } from "@/types";
import type { Query as QueryT, QueryResponse } from "@/types/query";

const PROMPTS = [
  "Find all water bodies near Mumbai",
  "What changed here since 2024?",
  "Classify land cover in Punjab",
  "Detect solar farms in Rajasthan",
];

interface Entry extends QueryMessage {
  response?: QueryResponse;
  /** Set only on entries created by `send()` in this session — gates the
      word-by-word reveal in `AssistantContent` so replaying seeded mock
      history never re-types itself out on mount. */
  fresh?: boolean;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Word-chunked typewriter for markdown content.
 *
 * Character-by-character would be truer to the terminal aesthetic, but it
 * also risks pausing mid-token on `**bold**` syntax for longer stretches;
 * revealing whole words (with their trailing whitespace) settles markdown
 * faster and reads less jittery for response-length text.
 *
 * Accessibility contract, same as `TypeOut`: the progressively-revealed copy
 * is `aria-hidden`, and the complete, fully-rendered markdown is written
 * ONCE into a `sr-only` node so a screen reader gets proper structure
 * (lists as lists, not a flattened word stream) immediately, independent of
 * whether the visual reveal is still running.
 */
function AssistantContent({ content, animate }: { content: string; animate: boolean }) {
  const tokens = useMemo(() => content.split(/(\s+)/), [content]);
  const [count, setCount] = useState(() => (animate && !prefersReducedMotion() ? 0 : tokens.length));

  // Only starts the interval — never calls setState synchronously in the
  // effect body. The `animate`-off / reduced-motion case is already handled
  // by the lazy `useState` initializer above, so there's nothing to reset
  // here; each Entry's `content` is immutable after creation, so this
  // effect's dependencies are stable and it only ever really runs once.
  useEffect(() => {
    if (!animate || prefersReducedMotion()) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= tokens.length) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
  }, [content, animate, tokens.length]);

  if (!animate) return <Markdown content={content} />;

  const done = count >= tokens.length;

  return (
    <div className="relative">
      <div aria-hidden="true">
        <Markdown content={tokens.slice(0, count).join("")} />
        {!done && (
          <span
            className="ml-0.5 inline-block h-[1em] w-[0.5em] translate-y-[0.15em] bg-phosphor align-baseline"
            style={{ animation: "caret-blink 1s step-end infinite" }}
          />
        )}
      </div>
      <div className="sr-only">
        <Markdown content={content} />
      </div>
    </div>
  );
}

function AttachmentChip({
  att,
}: {
  att: { type: string; label: string; confidence?: number };
}) {
  const Icon = att.type === "image" ? ImageIcon : att.type === "map_region" ? MapIcon : BarChart3;
  const tone = att.type === "image" ? "text-accent" : att.type === "map_region" ? "text-success" : "text-warning";
  return (
    <div className="flex items-center gap-3 rounded-md bg-bg-tertiary/60 px-3.5 py-2.5 min-w-[11rem]">
      <Icon className={cn("h-4 w-4 shrink-0", tone)} />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-mono-sm text-text-primary truncate">{att.label}</div>
        {att.confidence !== undefined && (
          <div className="mt-1.5">
            <ConfidenceBar value={att.confidence} showLabel={false} />
          </div>
        )}
      </div>
    </div>
  );
}

function Assistant({ entry }: { entry: Entry }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.slow, ease: ease.out }}
      className="group flex gap-4"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-tertiary text-atmos">
        <LogoMark size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2.5 font-mono text-mono-sm">
          <span className="font-semibold uppercase text-phosphor">SatQuery</span>
          <span className="text-text-faint">{formatTime(entry.timestamp)}</span>
        </div>

        <AssistantContent content={entry.content} animate={!!entry.fresh} />

        {entry.attachments && entry.attachments.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            {entry.attachments.map((a, i) => (
              <AttachmentChip key={i} att={a} />
            ))}
          </div>
        )}

        {entry.response && entry.response.result.kind === "vegetation" && (
          <VegetationResultPanel result={entry.response.result} />
        )}

        {entry.response && entry.response.result.kind === "water" && (
          <WaterResultPanel result={entry.response.result} />
        )}

        {entry.response && entry.response.result.kind === "land_cover" && (
          <LandCoverResultPanel result={entry.response.result} />
        )}

        {entry.response && entry.response.result.kind === "change" && (
          <ChangeResultPanel result={entry.response.result} />
        )}

        {entry.response && <AgentTrace response={entry.response} />}

        {entry.suggestedActions && entry.suggestedActions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {entry.suggestedActions.map((a, i) => (
              <button
                key={i}
                className="rounded-full bg-accent-muted px-3.5 py-1.5 font-mono text-mono-sm text-accent transition-colors duration-150 hover:bg-accent hover:text-white"
              >
                {a}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {[
            { icon: Copy, label: "Copy" },
            { icon: ThumbsUp, label: "Good response" },
            { icon: ThumbsDown, label: "Bad response" },
          ].map((b) => {
            const Icon = b.icon;
            return (
              <button
                key={b.label}
                aria-label={b.label}
                className="rounded-md p-1.5 text-text-faint transition-colors duration-150 hover:bg-bg-hover hover:text-text-secondary"
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function User({ entry }: { entry: Entry }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.base, ease: ease.out }}
      className="flex items-baseline gap-2.5 font-mono text-body text-text-primary"
    >
      <span aria-hidden="true" className="shrink-0 text-phosphor">
        &gt;
      </span>
      <span className="min-w-0">{entry.content}</span>
    </motion.div>
  );
}

/**
 * Ticks up from 0 for as long as it's mounted. `Thinking` only renders while
 * `busy` is true (`<AnimatePresence>{busy && <Thinking />}</AnimatePresence>`
 * in `Query()`), so it naturally mounts fresh — and starts back at zero —
 * every time a new query starts, with no explicit reset call needed: the
 * `setMs` call below runs inside the interval's callback, not synchronously
 * in the effect body, so this doesn't hit the set-state-in-effect case
 * `elapsedMs` state lifted into `Query()` did.
 */
function ElapsedCounter() {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setMs(Date.now() - start), 47);
    return () => clearInterval(id);
  }, []);
  return <>{ms.toString().padStart(4, "0")} ms</>;
}

function Thinking({ intent }: { intent?: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-tertiary">
        <ScanSweep variant="inline" className="w-4" />
      </span>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-mono-sm uppercase text-phosphor">
        <span>{intent ? `Running ${intent}` : "Analysing query"}</span>
        <span className="text-phosphor-dim">
          <ElapsedCounter />
        </span>
      </div>
    </div>
  );
}

export default function Query() {
  const { queryInput, setQueryInput } = useAppStore();
  const [entries, setEntries] = useState<Entry[]>(queryMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState<string | undefined>();
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Pick up a prompt handed over from the landing page, Help, or ⌘K.
  useEffect(() => {
    if (!queryInput) return;
    setInput(queryInput);
    setQueryInput("");
    requestAnimationFrame(() => taRef.current?.focus());
  }, [queryInput, setQueryInput]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: scrollBehavior() });
  }, [entries, busy]);

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text || busy) return;

      setEntries((p) => [
        ...p,
        { id: `m-${Date.now()}`, role: "user", content: text, timestamp: new Date().toISOString() },
      ]);
      setInput("");
      setBusy(true);
      setIntent(undefined);

      const q: QueryT = { id: `q-${Date.now()}`, raw: text, timestamp: new Date().toISOString() };

      try {
        const res = await processQueryAsync(q);
        setIntent(intentLabel(res.intent.type));
        await new Promise((r) => setTimeout(r, 260));
        setEntries((p) => [
          ...p,
          {
            id: `m-${Date.now() + 1}`,
            role: "assistant",
            content: res.responseText,
            timestamp: new Date().toISOString(),
            attachments: res.attachments,
            suggestedActions: res.suggestedActions,
            response: res,
            fresh: true,
          },
        ]);
      } catch {
        setEntries((p) => [
          ...p,
          {
            id: `m-${Date.now() + 1}`,
            role: "assistant",
            content: "I hit an error running that query. Please try again.",
            timestamp: new Date().toISOString(),
            fresh: true,
          },
        ]);
      } finally {
        setBusy(false);
        setIntent(undefined);
      }
    },
    [input, busy]
  );

  const empty = entries.length === 0;

  return (
    <div className="crt relative flex h-full flex-col overflow-hidden rounded-xl bg-bg-secondary/40">
      <h1 className="sr-only">Query</h1>

      {/* ── Conversation ── */}
      <div
        className="flex-1 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversation"
      >
        {empty ? (
          <div className="relative flex h-full items-center justify-center px-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-[6%] top-1/2 w-[34rem] -translate-y-1/2 opacity-25"
            >
              <EarthFallback animated={false} />
            </div>
            <div className="relative w-full max-w-[42rem]">
              <h2 className="text-title text-text-primary">Ask the planet<br />a question.</h2>
              <p className="mt-4 max-w-[42ch] text-[1.0625rem] leading-relaxed text-text-secondary">
                Natural language in, grounded analysis out — with the reasoning shown.
              </p>
              <div className="mt-9 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="bevel group flex items-center gap-2 rounded-md bg-bg-hover/40 px-4 py-3.5 text-left font-mono text-mono-sm text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-phosphor"
                  >
                    <span aria-hidden="true" className="text-phosphor-dim group-hover:text-phosphor">
                      &gt;
                    </span>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-[47.5rem] space-y-9 px-8 py-10 font-mono">
            {entries.map((e) =>
              e.role === "assistant" ? (
                <Assistant key={e.id} entry={e} />
              ) : (
                <User key={e.id} entry={e} />
              )
            )}
            <AnimatePresence>{busy && <Thinking intent={intent} />}</AnimatePresence>
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* ── Composer ── */}
      <div className="shrink-0 px-8 pb-7 pt-3">
        <div className="mx-auto max-w-[47.5rem]">
          <div className="crt relative flex items-end gap-3 overflow-hidden rounded-xl bg-bg-elevated/80 p-2.5 pl-5 backdrop-blur-xl transition-shadow duration-200 focus-within:shadow-[0_0_0_1px_var(--color-border-glow),0_0_38px_-8px_rgba(111,184,255,0.35)]">
            {busy && <BorderBeam size={90} duration={3} borderWidth={1.5} />}
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              disabled={busy}
              placeholder={busy ? "Analysis in progress…" : "> Ask about any place on Earth"}
              aria-label="Ask a question about satellite imagery"
              className="no-native-focus-ring max-h-40 min-h-[2.25rem] flex-1 resize-none bg-transparent py-2 font-mono text-body text-text-primary outline-none placeholder:text-text-muted"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || busy}
              aria-label="Send"
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                input.trim() && !busy
                  ? "bg-accent text-white hover:bg-accent-hover"
                  : "bg-bg-hover text-text-faint"
              )}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-3 text-center text-[0.6875rem] text-text-faint">
            Results are generated from mock analysis. Verify critical findings against ground truth.
          </p>
        </div>
      </div>
    </div>
  );
}
