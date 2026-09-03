import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { EarthFallback } from "@/components/hero/EarthFallback";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="relative flex min-h-[calc(100dvh-var(--shell-topbar-h))] items-center justify-center overflow-hidden px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[12%] top-1/2 -translate-y-1/2 w-[46rem] opacity-40"
      >
        <EarthFallback />
      </div>

      <div className="relative max-w-md">
        <div className="text-label uppercase text-text-faint mb-4">Signal lost</div>
        <h1 className="text-[6rem] leading-none font-thin tracking-[-0.02em] text-gradient">404</h1>
        <p className="mt-6 text-[1.0625rem] leading-relaxed text-text-secondary">
          That page is not in orbit. It may have been moved, or it never existed.
        </p>
        <Link to="/dashboard" className="inline-block mt-8">
          <Button variant="primary">
            <ArrowLeft className="h-4 w-4" /> Back to overview
          </Button>
        </Link>
      </div>
    </div>
  );
}
