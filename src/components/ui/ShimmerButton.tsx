import { forwardRef, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./buttonVariants";

/**
 * Adapted from Magic UI's ShimmerButton (magicui.design/docs/components/
 * shimmer-button, MIT) — same conic-gradient "spark" travelling around the
 * perimeter, same two keyframes (`shimmer-slide`, `spin-around`, defined in
 * `index.css`). Rebuilt on this app's own `buttonVariants` primary styling
 * instead of Magic UI's default black-background/white-spark look, and the
 * spark colour swapped for `--color-atmos` — so it reads as "the app's own
 * button, with one rare effect," not an imported widget.
 *
 * v5: the backdrop is now the Aqua gloss gradient (the same fill `.aqua`
 * uses) instead of a flat `bg-accent`, plus its own gloss-cap layer — this
 * is the landing page's one aqua CTA, so the Y2K shell material and the
 * travelling spark compose on the same button rather than competing.
 *
 * Same reasoning as `BorderBeam`: reserve this for exactly one CTA (the
 * landing hero's "Ask" submit) — it stops reading as special the moment a
 * second button on the same screen has it.
 */

export interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string;
  shimmerDuration?: string;
  size?: "sm" | "md" | "lg";
}

export const ShimmerButton = forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  ({ shimmerColor = "var(--color-atmos)", shimmerDuration = "2.5s", size = "md", className, children, style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        style={
          {
            "--spread": "90deg",
            "--shimmer-color": shimmerColor,
            "--speed": shimmerDuration,
            ...style,
          } as CSSProperties
        }
        className={cn(
          // Not `variant: "aqua"` here — that would also attach `.aqua`'s own
          // `::before` gloss-cap pseudo-element to this outer button, doubling
          // up with the gloss span added to the backdrop below. `primary`
          // just needs to supply a blue rim colour for the 1.5px gap around
          // the backdrop; the backdrop is what actually reads as "the button".
          buttonVariants({ variant: "primary", size }),
          // The variant's own `bg-accent` becomes the base layer the spark
          // travels behind; a slightly-inset "backdrop" (below) repaints
          // the same fill on top of it, leaving only a hairline rim where
          // the spark is visible — a travelling edge-light, not a wash
          // across the whole face.
          // `rounded-full` overrides the size variant's own `rounded-sm` —
          // a true pill, to actually match the fully-rounded composer it
          // sits inside rather than reading as a separate, squarer shape.
          "group relative isolate overflow-hidden rounded-full",
          className
        )}
        {...props}
      >
        {/* spark, full-bleed, behind the backdrop */}
        <span className="absolute inset-0 -z-20 overflow-hidden rounded-[inherit] @container-[size]">
          <span className="absolute inset-0 aspect-square h-[100cqh] animate-[shimmer-slide_var(--speed)_ease-in-out_infinite_alternate]">
            <span className="absolute -inset-full [animation:spin-around_calc(var(--speed)*2)_infinite_linear] [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))]" />
          </span>
        </span>
        {/* backdrop, inset by 1.5px so the spark shows only as a thin
            travelling rim at the true edge. Simplified from an earlier
            4-stop Aqua gradient (atmos-hover → accent → deep → accent-
            hover) plus a 55%-white gloss cap — that read as too busy/too
            bright, the white band in particular. Two stops, one hue, and a
            much fainter cap now — a hint of gloss, not a bright top half. */}
        <span
          className="absolute inset-[1.5px] -z-10 overflow-hidden rounded-[inherit]"
          style={{
            backgroundImage: "linear-gradient(180deg, var(--color-accent-hover) 0%, var(--color-accent) 100%)",
          }}
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 bottom-1/2 bg-gradient-to-b from-white/18 to-transparent"
          />
        </span>
        {children}
      </button>
    );
  }
);
ShimmerButton.displayName = "ShimmerButton";
