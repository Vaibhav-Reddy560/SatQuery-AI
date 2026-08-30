import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  User,
  Bot,
  Image,
  Map,
  BarChart3,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Loader2,
  MapPin,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { queryMessages } from "@/data/mockData";
import type { QueryMessage } from "@/types";
import type { Query, QueryResponse } from "@/types/query";
import { formatTime } from "@/lib/format";
import { processQueryAsync } from "@/services/queryEngine";
import { intentLabel } from "@/services/queryParser";

const quickPrompts = [
  "Identify buildings in the selected region",
  "Find all water bodies near Mumbai",
  "Compare vegetation cover between 2024 and 2026",
  "What areas show the most urban expansion?",
  "Estimate the area of deforestation in Sundarbans",
  "Detect solar panel installations in Rajasthan",
  "Classify land cover in Punjab",
  "Measure the area of this lake",
  "What changed since 2024?",
  "How far is the coastline?",
];

// ── Sub-components ─────────────────────────────────────────

function MarkdownLike({ content }: { content: string }) {
  const parts = content.split(/(\*\*.*?\*\*)/g);
  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="text-text-primary font-semibold">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}

function ProcessingIndicator({ intent }: { intent?: string }) {
  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 rounded-full bg-accent-muted flex items-center justify-center shrink-0 mt-0.5">
        <Loader2 className="h-4 w-4 text-accent animate-spin" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-text-primary">SatQuery</span>
          <Badge variant="info">Processing</Badge>
        </div>
        <div className="text-sm text-text-muted flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          {intent ? `Running ${intent}…` : "Analysing query…"}
        </div>
      </div>
    </div>
  );
}

function AssistantMessage({ msg }: { msg: QueryMessage }) {
  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 rounded-full bg-accent-muted flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="h-4 w-4 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-text-primary">SatQuery</span>
          <span className="text-xs text-text-muted">{formatTime(msg.timestamp)}</span>
        </div>
        <div className="text-text-secondary">
          <MarkdownLike content={msg.content} />
        </div>

        {/* Attachments */}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {msg.attachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary border border-border-subtle rounded-lg"
              >
                {att.type === "image" && <Image className="h-4 w-4 text-accent" />}
                {att.type === "map_region" && <Map className="h-4 w-4 text-success" />}
                {att.type === "data" && <BarChart3 className="h-4 w-4 text-warning" />}
                <div>
                  <div className="text-xs font-medium text-text-primary">{att.label}</div>
                  {att.confidence !== undefined && (
                    <div className="mt-1 w-24">
                      <ConfidenceBar value={att.confidence} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Suggested Actions */}
        {msg.suggestedActions && msg.suggestedActions.length > 0 && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {msg.suggestedActions.map((action, i) => (
              <button
                key={i}
                className="px-3 py-1.5 text-xs font-medium text-accent bg-accent-muted rounded-md hover:bg-accent hover:text-white transition-colors"
              >
                {action}
              </button>
            ))}
          </div>
        )}

        {/* Message Actions */}
        <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors" title="Copy" aria-label="Copy message">
            <Copy className="h-3 w-3" />
          </button>
          <button className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors" title="Good response" aria-label="Good response">
            <ThumbsUp className="h-3 w-3" />
          </button>
          <button className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors" title="Bad response" aria-label="Bad response">
            <ThumbsDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function UserMessage({ msg }: { msg: QueryMessage }) {
  return (
    <div className="flex gap-3 justify-end">
      <div className="flex-1 min-w-0 text-right">
        <div className="flex items-center gap-2 mb-1 justify-end">
          <span className="text-xs text-text-muted">{formatTime(msg.timestamp)}</span>
          <span className="text-sm font-medium text-text-primary">You</span>
        </div>
        <div className="inline-block text-left bg-accent text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed">
          {msg.content}
        </div>
      </div>
      <div className="h-8 w-8 rounded-full bg-bg-tertiary flex items-center justify-center shrink-0 mt-0.5">
        <User className="h-4 w-4 text-text-secondary" />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────

export default function Query() {
  const [messages, setMessages] = useState<QueryMessage[]>(queryMessages);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingIntent, setProcessingIntent] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isProcessing) return;

    // 1. Add user message
    const userMsg: QueryMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsProcessing(true);
    setProcessingIntent(undefined);

    // 2. Build query object
    const query: Query = {
      id: `q-${Date.now()}`,
      raw: text,
      timestamp: new Date().toISOString(),
    };

    // 3. Run the engine (simulated delay is built in)
    try {
      const response: QueryResponse = await processQueryAsync(query);

      // Show intent while "processing" completes
      setProcessingIntent(intentLabel(response.intent.type));

      // Small extra pause so user sees the intent label
      await new Promise((r) => setTimeout(r, 300));

      // 4. Add assistant message
      const assistantMsg: QueryMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: response.responseText,
        timestamp: new Date().toISOString(),
        attachments: response.attachments,
        suggestedActions: response.suggestedActions,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: QueryMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: "I encountered an error processing your query. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
      setProcessingIntent(undefined);
    }
  }, [input, isProcessing]);

  return (
    <div className="flex h-[calc(100vh-8rem)] -m-6 p-0">
      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-muted mb-4">
                  <Sparkles className="h-7 w-7 text-accent" />
                </div>
                <h2 className="text-lg font-semibold text-text-primary mb-2">Ask anything about satellite imagery</h2>
                <p className="text-sm text-text-muted mb-6">
                  Ask natural-language questions about areas, objects, changes, and conditions visible in satellite data.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {quickPrompts.slice(0, 6).map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(prompt)}
                      className="text-left px-3 py-2.5 text-sm text-text-secondary bg-bg-secondary border border-border-subtle rounded-lg hover:border-accent/50 hover:text-text-primary transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className="group">
                  {msg.role === "assistant" ? (
                    <AssistantMessage msg={msg} />
                  ) : (
                    <UserMessage msg={msg} />
                  )}
                </div>
              ))}

              {/* Processing indicator */}
              {isProcessing && <ProcessingIndicator intent={processingIntent} />}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="border-t border-border-default px-6 py-4 bg-bg-secondary/50">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 bg-bg-tertiary border border-border-default rounded-xl px-4 py-3 focus-within:border-accent transition-colors">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isProcessing ? "Analysis in progress…" : "Ask a question about satellite imagery..."}
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none resize-none min-h-[24px] max-h-[120px]"
                rows={1}
                disabled={isProcessing}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isProcessing}
                className="p-2 bg-accent rounded-lg text-white hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                aria-label="Send query"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-text-muted mt-2 text-center">
              SatQuery AI — Responses are based on mock satellite imagery analysis. Verify critical findings with ground truth.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Prompts Sidebar */}
      <div className="w-72 flex-shrink-0 border-l border-border-default bg-bg-secondary/30 hidden lg:block overflow-y-auto">
        <div className="p-4">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Quick Prompts</h3>
          <div className="space-y-1.5">
            {quickPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => setInput(prompt)}
                disabled={isProcessing}
                className="w-full text-left px-3 py-2.5 text-sm text-text-secondary rounded-lg hover:bg-bg-hover hover:text-text-primary transition-colors border border-transparent hover:border-border-subtle disabled:opacity-40"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-border-subtle">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Recent Queries</h3>
            <div className="space-y-2">
              {messages
                .filter((m) => m.role === "user")
                .slice(-5)
                .reverse()
                .map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => setInput(msg.content)}
                    disabled={isProcessing}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-text-muted rounded-lg hover:bg-bg-hover hover:text-text-secondary transition-colors disabled:opacity-40"
                  >
                    <Sparkles className="h-3 w-3 shrink-0" />
                    <span className="truncate">{msg.content}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
