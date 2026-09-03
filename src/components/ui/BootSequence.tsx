import { useState } from "react";
import { Terminal, TerminalLine } from "./Terminal";
import { TypeOut } from "./TypeOut";
import { cn } from "@/lib/utils";

/**
 * Landing's terminal boot log — lines type in one at a time, `>` prompt on
 * each, caret sitting only on whichever line is currently active. Content
 * (dot-leaders, "OK"/"READY" suffixes) is authored at the call site; this
 * component only orchestrates the reveal.
 *
 * All `lines.length` rows render from the very first frame — only
 * `lines.slice(0, active + 1)` used to render, so the terminal grew a row
 * taller every time a new line started, pushing everything below it (the
 * telemetry ticker) further down the page over the ~1s the boot sequence
 * takes to finish. Not-yet-active lines now render as an `invisible`
 * placeholder of the same text, reserving their line's height (and the
 * `space-y-1.5` gap for it) immediately, so the terminal is its final
 * height on first paint — nothing shifts as lines fill in, only their
 * content changes.
 */

export function BootSequence({
  lines,
  className,
  speed = 14,
  lineDelay = 220,
}: {
  lines: string[];
  className?: string;
  /** Milliseconds per character. */
  speed?: number;
  /** Pause between one line finishing and the next starting. */
  lineDelay?: number;
}) {
  const [active, setActive] = useState(0);

  return (
    // Chrome housing around the terminal — the same console-body / inset-
    // screen split every other CRT panel in the app uses. This was a bare
    // `Terminal` with only its own steel bezel and no console around it —
    // a screen sitting loose rather than built into the console body.
    <div className={cn("chrome rounded-lg p-3", className)}>
      <Terminal>
        {lines.map((line, i) => (
          <TerminalLine key={i} prompt>
            {i <= active ? (
              <TypeOut
                text={line}
                speed={speed}
                showCaret={i === active}
                onDone={() => {
                  if (i === active && active < lines.length - 1) {
                    window.setTimeout(() => setActive((a) => a + 1), lineDelay);
                  }
                }}
              />
            ) : (
              <span aria-hidden="true" className="invisible">
                {line}
              </span>
            )}
          </TerminalLine>
        ))}
      </Terminal>
    </div>
  );
}
