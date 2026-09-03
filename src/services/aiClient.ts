/**
 * ChatGPT-style assistant transport shared by every AI surface.
 *
 * Resolution order:
 *   1. Backend `/api/v1/ai/chat` — the API key (GOOGLE_API_KEY) stays
 *      server-side. This is the intended path in production.
 *   2. Direct Gemini REST from the browser when `VITE_GEMINI_API_KEY` is set
 *      — lets `npm run dev` (no backend) demo the real assistant too.
 *   3. `null` — the caller degrades to its deterministic behaviour.
 *
 * No surface should ever depend on the model being reachable: treat a
 * `null` return as "run the fallback", never as a crash.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

const GEMINI_REST_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";

function clientModel(): string {
  return import.meta.env.VITE_GEMINI_MODEL || "gemini-3.8-flash";
}

function clientKey(): string | undefined {
  const key = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();
  return key || undefined;
}

/** Whether the browser itself can reach Gemini without the backend. */
export function hasBrowserGeminiKey(): boolean {
  return clientKey() !== undefined;
}

export interface AiTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AiChatOptions {
  /** Conversation so far, oldest first. The last turn should be the user's. */
  messages: AiTurn[];
  /** Role/behaviour instructions for the assistant (remote-sensing expert…). */
  systemPrompt?: string;
  /** Optional grounded data (markdown/JSON) the assistant may cite. */
  context?: string;
  temperature?: number;
  maxTokens?: number;
  /** Short-circuit when the caller unmounts. */
  signal?: AbortSignal;
}

export interface AiChatResult {
  reply: string;
  model: string;
  /** Where the completion came from — surfaced in UI status chips. */
  source: "backend" | "browser";
}

export interface AiStatus {
  configured: boolean;
  source: "backend" | "browser" | "offline";
  model: string;
}

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = () => controller.abort();
  init.signal?.addEventListener("abort", onOuterAbort);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", onOuterAbort);
  });
}

function normalizeMessages(messages: AiTurn[]): { role: string; content: string }[] {
  return messages
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content.trim() }));
}

async function viaBackend(opts: AiChatOptions): Promise<AiChatResult | null> {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/ai/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: normalizeMessages(opts.messages),
          system_prompt: opts.systemPrompt,
          context: opts.context,
          temperature: opts.temperature,
          max_tokens: opts.maxTokens,
        }),
      },
      60_000
    );
    if (!res.ok) {
      console.warn(`AI backend unavailable (HTTP ${res.status}) — falling back.`);
      return null;
    }
    const data = (await res.json()) as { reply?: string; model?: string };
    const reply = data.reply?.trim();
    if (!reply) return null;
    return { reply, model: data.model || "gemini", source: "backend" };
  } catch (error) {
    console.warn("AI backend not reached — falling back.", error);
    return null;
  }
}

const RETRYABLE_STATUS = new Set([429, 500, 503]);

async function viaBrowserGemini(opts: AiChatOptions): Promise<AiChatResult | null> {
  const key = clientKey();
  if (!key) return null;

  const model = clientModel();
  const contents = normalizeMessages(opts.messages).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const systemPrompt = [opts.systemPrompt, opts.context].filter(Boolean).join("\n\n");
  const payload: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.6,
      maxOutputTokens: opts.maxTokens ?? 1024,
    },
  };
  if (systemPrompt.trim()) {
    payload.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  // The free tier occasionally answers with transient 503 "high demand" —
  // retry once with a short pause before giving up.
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetchWithTimeout(
        `${GEMINI_REST_URL.replace("{model}", model)}?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        60_000
      );
    } catch (error) {
      console.warn("Gemini browser call failed — falling back.", error);
      return null;
    }

    if (res.ok) {
      const raw: unknown = await res.json();
      const parsed = raw as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const first = parsed.candidates?.[0];
      const parts = first?.content?.parts ?? [];
      const reply = parts.map((p) => p.text ?? "").join("").trim();
      if (!reply) return null;
      return { reply, model, source: "browser" };
    }

    const body = await res.text().catch(() => "");
    console.warn(`Gemini browser call failed (HTTP ${res.status}) — ${body}`);
    if (!RETRYABLE_STATUS.has(res.status) || attempt === 1) return null;
    await new Promise((r) => setTimeout(r, 1200));
  }
  return null;
}

/**
 * One assistant turn. Returns the model reply, or `null` when no AI path is
 * configured/reachable (callers fall back to deterministic behaviour).
 */
export async function chatWithAi(opts: AiChatOptions): Promise<AiChatResult | null> {
  // Backend first (key stays server-side), then the browser key for dev.
  const fromBackend = await viaBackend(opts);
  if (fromBackend) return fromBackend;
  return viaBrowserGemini(opts);
}

/** Live configuration check — used by Settings and the per-page panels. */
export async function aiStatus(): Promise<AiStatus> {
  // Backend authoritative when reachable.
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/ai/status`, { method: "GET" }, 5_000);
    if (res.ok) {
      const data = (await res.json()) as { provider?: string; model?: string };
      return {
        configured: data.provider === "gemini",
        source: data.provider === "gemini" ? "backend" : "offline",
        model: data.model || "gemini",
      };
    }
  } catch {
    // Backend not running — fall through to the browser key.
  }
  if (clientKey()) {
    return { configured: true, source: "browser", model: clientModel() };
  }
  return { configured: false, source: "offline", model: clientModel() };
}
