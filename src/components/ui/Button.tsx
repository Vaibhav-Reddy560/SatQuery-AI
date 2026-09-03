import { type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./buttonVariants";

/**
 * The button every surface in the app uses.
 *
 * Replaces the identical 15-class string that was copy-pasted across six
 * pages. `glass` is the variant for controls that float over the map or the
 * globe; `secondary` is the workhorse.
 */

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, iconOnly, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, iconOnly }), className)}
      {...props}
    />
  )
);
Button.displayName = "Button";
