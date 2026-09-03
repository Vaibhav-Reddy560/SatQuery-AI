import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const base = [
  "w-full bg-bg-tertiary text-text-primary",
  "border border-border-default rounded-md",
  "placeholder:text-text-muted",
  "transition-[border-color,box-shadow,background-color] duration-150",
  "hover:border-border-glass",
  // `no-native-focus-ring` opts out of the global outline (a solid 2px
  // atmos box sitting proud of the field) — every text field in the app
  // was drawing that as a second, awkward-looking rectangle around
  // itself. This is NOT the same failed attempt the old comment here
  // warned about: that one replaced the indicator with a ~10%-alpha
  // shadow ring (~1.05:1 contrast, functionally invisible). This keeps
  // `focus:border-accent` + `focus:bg-bg-elevated` — an opaque, full-
  // strength colour and background change — as the actual accessible
  // indicator, and widens the border itself on focus so the change reads
  // unambiguously even at a glance, not just a shadow trying to stand in
  // for one.
  "no-native-focus-ring focus:border-accent focus:border-2 focus:bg-bg-elevated",
  "disabled:opacity-40 disabled:pointer-events-none",
].join(" ");

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(base, "h-10 px-3.5 text-sm", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(base, "px-3.5 py-2.5 text-sm resize-none", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";
