import { cn } from "@/lib/utils";

/**
 * HUD radar sweep — a soft band translating across its container.
 *
 * `overlay` fills a positioned parent (the Earth hero, an `ImageViewport`
 * mid-analysis); `inline` is a small horizontal bar for in-flow "working"
 * states, replacing a generic ring spinner. Both are purely decorative
 * (`aria-hidden`) — the accessible state lives in whatever text sits next
 * to it ("Analysing query…", "Running object_detection…").
 */

export function ScanSweep({
  className,
  variant = "overlay",
}: {
  className?: string;
  variant?: "overlay" | "inline";
}) {
  if (variant === "inline") {
    return (
      <span
        aria-hidden="true"
        className={cn("relative inline-block h-1 w-16 overflow-hidden rounded-full bg-bg-hover", className)}
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{
            backgroundImage: "linear-gradient(90deg, transparent, var(--color-atmos), transparent)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.4s linear infinite",
          }}
        />
      </span>
    );
  }

  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div
        className="absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-atmos/25 to-transparent"
        style={{ animation: "scan-sweep 3.2s ease-in-out infinite" }}
      />
    </div>
  );
}
