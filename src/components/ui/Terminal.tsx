import { cn, SCREEN_BEZEL } from "@/lib/utils";

/**
 * The terminal surface — CRT scanlines, mono type, `>` prompts, a blinking
 * block caret. This is the terminal layer's one material: it belongs on
 * text output (the Query stream, logs, readouts), never on chrome or
 * imagery — see the layer table in the design plan.
 */

export function Terminal({
  children,
  className,
  showCaret = false,
}: {
  children: React.ReactNode;
  className?: string;
  showCaret?: boolean;
}) {
  return (
    <div
      className={cn(
        "crt relative overflow-hidden rounded-lg bg-bg-primary px-4 py-3",
        "font-mono text-mono text-phosphor phosphor-glow",
        className
      )}
      style={{ boxShadow: SCREEN_BEZEL }}
    >
      <div className="relative space-y-1.5">
        {children}
        {showCaret && (
          <span
            aria-hidden="true"
            className="ml-0.5 inline-block h-[1em] w-[0.5em] translate-y-[0.15em] bg-phosphor align-baseline"
            style={{ animation: "caret-blink 1s step-end infinite" }}
          />
        )}
      </div>
    </div>
  );
}

export function TerminalLine({
  prompt = false,
  children,
  className,
}: {
  prompt?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-2", className)}>
      {/* Dim AND un-glowed — `phosphor-glow` on the `Terminal` ancestor
          inherits via `text-shadow`, and a glow at full intensity behind a
          40%-opacity glyph reads as a mistake, not restraint. */}
      {prompt && (
        <span aria-hidden="true" className="shrink-0 text-phosphor-dim [text-shadow:none]">
          &gt;
        </span>
      )}
      <span className="min-w-0">{children}</span>
    </div>
  );
}
