import { useRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Surface primitive.
 *
 * Borderless by default: surfaces are separated by fill and whitespace, not
 * outlines. Outlines everywhere are what made the first pass read as a
 * cluttered admin dashboard.
 *
 * `glow` adds a saturated radial wash bleeding from one corner. Use it for at
 * most one card per screen — it stops reading as special the moment there are
 * two.
 */

const card = cva("relative rounded-xl", {
  variants: {
    variant: {
      /** Default: a fill, no outline. */
      plain: "bg-bg-secondary",
      /** Fill plus a hairline, for when a boundary genuinely helps. */
      outlined: "bg-bg-secondary border border-border-subtle",
      glass: "glass edge-lit",
      /** Brushed-steel panel with a glow wash bled from one corner. */
      glow: "metal",
      /** Y2K dark chrome panel — shell/chrome layer (nav, tiles, panels). */
      chrome: "chrome",
      /** Instrument bay — fine technical grid, for imagery/HUD content. */
      hud: "bg-bg-primary hud-grid border border-border-subtle",
      /** No surface at all — just a positioning/padding context. */
      bare: "",
    },
    padding: {
      none: "",
      sm: "p-5",
      md: "p-7",
      lg: "p-9",
    },
    interactive: {
      true: [
        "transition-[background-color,transform,box-shadow] duration-200",
        "hover:bg-bg-tertiary hover:shadow-raised",
      ],
      false: "",
    },
    clip: { true: "overflow-hidden", false: "" },
  },
  defaultVariants: {
    variant: "plain",
    padding: "none",
    interactive: false,
    clip: false,
  },
});

type Glow = "accent" | "atmos" | "warning" | "success" | "info";

const GLOW_RGB: Record<Glow, string> = {
  accent: "61,127,255",
  atmos: "111,184,255",
  warning: "157,184,232",
  success: "61,127,255",
  info: "111,184,255",
};

const GLOW_POS = {
  "top-left": "0% 0%",
  "top-right": "100% 0%",
  "bottom-left": "0% 100%",
  "bottom-right": "100% 100%",
  center: "50% 50%",
} as const;

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof card> {
  glow?: Glow;
  glowFrom?: keyof typeof GLOW_POS;
}

export function Card({
  className,
  variant,
  padding,
  interactive,
  clip,
  glow = "accent",
  glowFrom = "top-right",
  children,
  onMouseMove,
  onMouseLeave,
  ...props
}: CardProps) {
  const glowRef = useRef<HTMLDivElement>(null);
  const home = GLOW_POS[glowFrom];
  // Cursor-tracking is independent of `interactive`: the moving glow is
  // ambient surface feedback, not a claim that the card is clickable. That
  // claim is `interactive`'s hover background/shadow-lift alone. Gating the
  // glow on `interactive` too meant it had zero live usage anywhere in the
  // app the moment Landing's capability tiles stopped being links.
  const trackGlow = variant === "glow";

  return (
    <div
      className={cn(
        card({
          variant,
          padding,
          interactive,
          clip: clip ?? (variant === "glow" || variant === "chrome" || variant === "hud"),
        }),
        className
      )}
      onMouseMove={(e) => {
        onMouseMove?.(e);
        if (!trackGlow || !glowRef.current) return;
        const r = e.currentTarget.getBoundingClientRect();
        glowRef.current.style.setProperty("--glow-x", `${((e.clientX - r.left) / r.width) * 100}%`);
        glowRef.current.style.setProperty("--glow-y", `${((e.clientY - r.top) / r.height) * 100}%`);
      }}
      onMouseLeave={(e) => {
        onMouseLeave?.(e);
        if (!trackGlow || !glowRef.current) return;
        const [gx, gy] = home.split(" ");
        glowRef.current.style.setProperty("--glow-x", gx);
        glowRef.current.style.setProperty("--glow-y", gy);
      }}
      {...props}
    >
      {variant === "glow" && (
        // For `interactive` cards the glow follows the cursor (a spotlight,
        // not a fixed corner wash) — reinforces that the surface is
        // clickable, the same way a real pointer highlight would. Static
        // (non-interactive) glow cards keep the original fixed-corner wash;
        // there's nothing to "follow" on a card that isn't a target.
        <div
          ref={glowRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={
            trackGlow
              ? ({
                  "--glow-x": home.split(" ")[0],
                  "--glow-y": home.split(" ")[1],
                  backgroundImage: `radial-gradient(220px circle at var(--glow-x) var(--glow-y), rgba(${GLOW_RGB[glow]},0.30) 0%, rgba(${GLOW_RGB[glow]},0.10) 45%, transparent 70%)`,
                  transition: "--glow-x 400ms ease-out, --glow-y 400ms ease-out",
                } as React.CSSProperties)
              : { background: `radial-gradient(120% 90% at ${home}, rgba(${GLOW_RGB[glow]},0.26) 0%, rgba(${GLOW_RGB[glow]},0.08) 38%, transparent 70%)` }
          }
        />
      )}
      {/*
        Children are rendered directly, NOT inside a wrapper div — a wrapper
        silently breaks `flex`/`h-full` passed via className on the Card.
        The glow layer above is absolutely positioned, so it does not
        participate in layout and children still stack correctly above it
        via the isolation created by `relative` on the root.
      */}
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative flex items-start justify-between gap-4 px-7 pt-7 pb-0",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-subheading text-text-primary leading-tight",
        className
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-body-sm text-text-muted mt-1", className)} {...props} />
  );
}

/**
 * Content region.
 *
 * Always carries top padding. CardHeader deliberately has none at the bottom,
 * so header+content and content-alone both resolve to a 28px inset — a Card
 * used without a header never renders text flush against its top edge.
 */
export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative px-7 pt-7 pb-7", className)} {...props} />;
}
