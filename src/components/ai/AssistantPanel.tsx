import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { LogoMark } from "@/components/brand/LogoMark";
import { Markdown } from "@/components/query/Markdown";
import { ScanSweep } from "@/components/ui/ScanSweep";
import { aiStatus, chatWithAi, type AiTurn } from "@/services/aiClient";
import { OFFLINE_MODE_NOTICE, SATQUERY_SYSTEM_PROMPT } from "@/services/aiPrompts";
import { cn } from "@/lib/utils";

/**
 * ChatGPT-style assistant panel that pages embed to answer questions about
 * the data on screen. The panel is context-aware: every request carries the
 * page's `systemPrompt` framing plus a `context` summary of the visible
 * data, so answers stay grounded in what the page actually shows.
 *
 * When no AI provider is configured (backend offline AND no browser key),
 * the panel replies from a human-written `briefing` of the page's data and
 * explains how to switch the live model on — it never pretends to be the
 * model.
 */

export interface PanelMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Offline/local replies are shown but never replayed to the model. */
  local?: boolean;
  /** True when the reply came from the live Gemini model. */
  live?: boolean;
}

export interface AssistantPanelProps {
  /** Header title, e.g. "Workspace assistant". */
  title?: string;
  /** Short page kicker shown above the title, e.g. "OVERVIEW · AI". */
  eyebrow?: string;
  /** Role instructions for the model on this page. */
  systemPrompt?: string;
  /** Grounded data dump (markdown/JSON) describing what this page shows. */
  context?: string;
  /** 2–4 line human summary of the page, used for offline-mode replies. */
  briefing?: string;
  /** Clickable example questions shown while the panel is fresh. */
  prompts?: string[];
  placeholder?: string;
  defaultOpen?: boolean;
  className?: string;
}

type LiveState = { configured: boolean; label: string };

export function AssistantPanel({
  title = "SatQuery AI",
  eyebrow,
  systemPrompt = SATQUERY_SYSTEM_PROMPT,
  context,
  briefing,
  prompts = [],
  placeholder = "Ask about this page…",
  defaultOpen = true,
  className,
}: AssistantPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<PanelMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<LiveState>({ configured: false, label: "checking…" });
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Detect whether the model is reachable (backend key, else browser key).
  useEffect(() => {
    let mounted = true;
    aiStatus().then((status) => {
      if (!mounted) return;
      setLive(
        status.configured
          ? { configured: true, label: "Live · Gemini" }
          : { configured: false, label: "Offline" }
      );
    });
    return () => {
      mounted = false;
    };
  }, []);

  const history: AiTurn[] = useMemo(
    () =>
      messages
        .filter((m) => !m.local && m.content.trim())
        .map((m) => ({ role: m.role, content: m.content })),
    [messages]
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  function offlineReply(question: string): string {
    const bullet =
      prompts.length > 0
        ? prompts.map((p) => `• ${p}`).join("\n")
        : "• Anything about the data on this page";
    const briefingLine = briefing
      ? `Here's what this page shows:\n\n${briefing}\n`
      : "I don't have live AI access on this page right now.";
    return `${briefingLine}

**Live AI isn't connected** (no Gemini API key on this deployment), so I answered locally instead of with the model. Once a key is added — Settings → AI assistant — I can answer "${question}" properly, including follow-ups.

While offline you can ask about things like:
${bullet}

${OFFLINE_MODE_NOTICE}`;
  }

  async function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || busy) return;

    const userMsg: PanelMessage = {
      id: `p-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setBusy(true);

    try {
      const result = await chatWithAi({
        messages: [...history, { role: "user", content: text }],
        systemPrompt,
        context,
        maxTokens: 900,
      });

      const reply: PanelMessage = result
        ? {
            id: `p-${Date.now() + 1}`,
            role: "assistant",
            content: result.reply,
            live: true,
          }
        : {
            id: `p-${Date.now() + 1}`,
            role: "assistant",
            content: offlineReply(text),
            local: true,
          };
      setMessages((p) => [...p, reply]);
      if (result) setLive({ configured: true, label: "Live · Gemini" });
    } catch {
      setMessages((p) => [
        ...p,
        {
          id: `p-${Date.now() + 1}`,
          role: "assistant",
          content:
            "I ran into an error reaching the AI service. Please try again in a moment.",
          local: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const fresh = messages.length === 0;

  return (
    <section className={cn("chrome rounded-lg p-3", className)}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-hover text-atmos">
            <LogoMark size={13} />
          </span>
          <div className="min-w-0">
            {eyebrow && (
              <div className="font-mono text-mono-sm uppercase leading-none text-text-muted">
                {eyebrow}
              </div>
            )}
            <div className="truncate text-body-sm font-semibold text-text-primary">{title}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "hidden items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-mono-sm sm:flex",
              live.configured ? "text-phosphor" : "text-text-muted"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                live.configured ? "bg-phosphor" : "bg-text-faint"
              )}
            />
            {live.label}
          </span>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Collapse assistant" : "Expand assistant"}
            className="bevel flex h-7 w-7 items-center justify-center rounded-md bg-bg-hover text-text-secondary transition-colors duration-150 hover:bg-bg-hover/70 hover:text-text-primary"
          >
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {!open && (
        <p className="mt-2 px-1 text-body-sm text-text-muted">
          Ask the AI about the data on this page — click to open.
        </p>
      )}

      {/* ── Body ── */}
      {open && (
        <div className="mt-3">
          <div
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            className="max-h-[26rem] space-y-4 overflow-y-auto rounded-md bg-bg-primary/80 p-4"
          >
            {fresh && (
              <div className="flex items-center gap-3 py-2 font-mono text-mono-sm text-phosphor-dim">
                <Sparkles className="h-3.5 w-3.5 text-atmos" />
                <span>Ask about this page — analysis data included as context.</span>
              </div>
            )}

            {messages.map((m) =>
              m.role === "assistant" ? (
                <div key={m.id} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-tertiary text-atmos">
                    <LogoMark size={10} />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <Markdown content={m.content} />
                    {m.local && (
                      <div className="mt-2 font-mono text-mono-sm text-text-faint">
                        ← generated locally (no live AI key)
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex items-baseline gap-2.5 font-mono text-body-sm text-text-primary">
                  <span aria-hidden="true" className="shrink-0 text-phosphor">
                    &gt;
                  </span>
                  <span className="min-w-0">{m.content}</span>
                </div>
              )
            )}

            {busy && (
              <div className="flex items-center gap-3 font-mono text-mono-sm uppercase text-phosphor">
                <ScanSweep variant="inline" className="w-10" />
                <span>Thinking…</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Example prompts while fresh */}
          {fresh && prompts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {prompts.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  disabled={busy}
                  className="bevel rounded-full bg-bg-hover px-3 py-1.5 font-mono text-mono-sm text-text-secondary transition-colors duration-150 hover:bg-bg-hover/70 hover:text-phosphor"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Composer */}
          <div className="mt-3 flex items-end gap-2 rounded-lg bg-bg-elevated/80 p-2 pl-4 focus-within:shadow-[0_0_0_1px_var(--color-border-glow)]">
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              disabled={busy}
              placeholder={busy ? "Thinking…" : placeholder}
              aria-label={placeholder}
              className="no-native-focus-ring max-h-[7.5rem] min-h-[2rem] flex-1 resize-none bg-transparent py-1.5 font-mono text-body-sm text-text-primary outline-none placeholder:text-text-muted"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || busy}
              aria-label="Send"
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                input.trim() && !busy
                  ? "bg-accent text-white hover:bg-accent-hover"
                  : "bg-bg-hover text-text-faint"
              )}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 px-1 text-[0.6875rem] text-text-faint">
            AI-generated answers — verify critical findings before acting on them.
          </p>
        </div>
      )}
    </section>
  );
}
