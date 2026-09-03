import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Typewriter reveal for terminal surfaces.
 *
 * Accessibility contract: the animating text is `aria-hidden`. A
 * character-by-character reveal inside `role="log"`/`aria-live="polite"`
 * (the Query stream, `Query.tsx:226-232`) would otherwise make VoiceOver
 * announce the string one letter at a time as each update lands in the live
 * region. The complete text is instead written ONCE into a visually-hidden
 * node on the very first render, so assistive tech gets the real content
 * immediately — independent of whether the visual animation is running,
 * stalled, or (under reduced motion) skipped outright.
 *
 * Reduced motion renders the full text immediately, checked in JS: the
 * global reduced-motion rule in `index.css` collapses animation/transition
 * *durations*, but it has no way to stop a JS-driven `setInterval` character
 * loop like this one.
 */

export function TypeOut({
  text,
  speed = 18,
  className,
  onDone,
  showCaret = true,
}: {
  text: string;
  /** Milliseconds per character. */
  speed?: number;
  className?: string;
  onDone?: () => void;
  showCaret?: boolean;
}) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? text : ""));
  const [done, setDone] = useState(prefersReducedMotion);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(text);
      setDone(true);
      onDoneRef.current?.();
      return;
    }
    let i = 0;
    setShown("");
    setDone(false);
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
        onDoneRef.current?.();
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return (
    <span className={cn("relative", className)}>
      <span aria-hidden="true">
        {shown}
        {showCaret && !done && (
          <span
            className="ml-0.5 inline-block h-[1em] w-[0.5em] translate-y-[0.15em] bg-phosphor align-baseline"
            style={{ animation: "caret-blink 1s step-end infinite" }}
          />
        )}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
