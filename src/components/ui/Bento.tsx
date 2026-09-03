import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { fadeRise, stagger, inView } from "@/lib/motion";

/**
 * 12-column bento grid. Tiles reveal in a stagger the first time the grid
 * scrolls into view.
 */
export function Bento({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <motion.div
      variants={stagger(0, 0.04)}
      initial="hidden"
      whileInView="show"
      viewport={inView}
      className={cn("grid grid-cols-1 md:grid-cols-6 xl:grid-cols-12 gap-4", className)}
      {...(props as React.ComponentProps<typeof motion.div>)}
    >
      {children}
    </motion.div>
  );
}

const SPAN: Record<number, string> = {
  2: "xl:col-span-2 md:col-span-2",
  3: "xl:col-span-3 md:col-span-3",
  4: "xl:col-span-4 md:col-span-3",
  5: "xl:col-span-5 md:col-span-3",
  6: "xl:col-span-6 md:col-span-6",
  7: "xl:col-span-7 md:col-span-6",
  8: "xl:col-span-8 md:col-span-6",
  9: "xl:col-span-9 md:col-span-6",
  12: "xl:col-span-12 md:col-span-6",
};

export function BentoTile({
  span = 4,
  className,
  children,
  ...props
}: { span?: keyof typeof SPAN } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <motion.div
      variants={fadeRise}
      className={cn(SPAN[span] ?? SPAN[4], className)}
      {...(props as React.ComponentProps<typeof motion.div>)}
    >
      {children}
    </motion.div>
  );
}
