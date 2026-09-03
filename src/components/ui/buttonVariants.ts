import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 shrink-0",
    "font-medium whitespace-nowrap",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150",
    "active:scale-[0.98]",
    "disabled:opacity-40 disabled:pointer-events-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atmos",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-accent text-white",
          "shadow-[0_1px_0_0_rgba(255,255,255,0.14)_inset,0_6px_20px_-6px_rgba(61,127,255,0.7)]",
          "hover:bg-accent-hover hover:shadow-[0_1px_0_0_rgba(255,255,255,0.18)_inset,0_8px_28px_-6px_rgba(61,127,255,0.85)]",
        ],
        secondary: [
          "bg-bg-tertiary text-text-secondary border border-border-default",
          "hover:bg-bg-hover hover:text-text-primary hover:border-border-glass",
        ],
        ghost: ["text-text-muted", "hover:text-text-primary hover:bg-bg-hover"],
        glass: [
          "glass edge-lit text-text-secondary",
          "hover:text-text-primary hover:border-border-glow",
        ],
        danger: [
          "bg-danger-muted text-danger border border-transparent",
          "hover:bg-danger hover:text-white",
        ],
        accentSoft: [
          "bg-accent-muted text-accent border border-transparent",
          "hover:bg-accent hover:text-white",
        ],
        /**
         * Y2K dark chrome — shell/chrome layer only, never on text output.
         * Two tactile-hardware details, both drawn as pseudo-elements so no
         * extra DOM node is needed: a small glowing LED (top-right, reads
         * "this control is live") and an L-shaped corner bracket
         * (top-left, the same border-only technique `HudFrame`'s corner
         * brackets use). A literal `clip-path` corner chamfer was tried and
         * dropped — clipping a rounded corner to a hard polygon point also
         * squares off the OTHER three corners, which broke the rounded-rect
         * language every other surface in the app uses.
         */
        chrome: [
          "chrome relative text-text-secondary",
          "before:absolute before:top-0 before:left-0 before:h-2 before:w-2 before:border-t before:border-l before:border-atmos/50 before:content-['']",
          "after:absolute after:top-1.5 after:right-1.5 after:h-1.5 after:w-1.5 after:rounded-full after:bg-phosphor after:shadow-[0_0_6px_2px_rgba(77,238,255,0.75)] after:content-['']",
          "hover:text-text-primary hover:shadow-[inset_0_1px_0_0_var(--color-chrome-lit),inset_0_-1px_0_0_rgba(0,0,0,0.5),0_0_0_1px_var(--color-border-glow)]",
        ],
        /** Glossy Aqua pill — reserve for one CTA per screen. */
        aqua: [
          "aqua text-white",
          "hover:brightness-[1.08]",
        ],
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-sm",
        md: "h-10 px-4 text-sm rounded-md",
        lg: "h-12 px-6 text-[0.9375rem] rounded-lg",
      },
      iconOnly: {
        true: "px-0 aspect-square",
        false: "",
      },
    },
    compoundVariants: [
      { iconOnly: true, size: "sm", class: "w-8" },
      { iconOnly: true, size: "md", class: "w-10" },
      { iconOnly: true, size: "lg", class: "w-12" },
    ],
    defaultVariants: { variant: "secondary", size: "md", iconOnly: false },
  }
);
