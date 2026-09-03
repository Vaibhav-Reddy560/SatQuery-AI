import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MotionConfig } from "motion/react";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { Skeleton } from "@/components/ui/Skeleton";

// Route-level splitting keeps maplibre (245KB gz) and recharts (109KB gz) out
// of the entry graph — neither is needed to render the landing page.
const Landing = lazy(() => import("@/pages/Landing"));
const Overview = lazy(() => import("@/pages/Overview"));
const Explore = lazy(() => import("@/pages/Explore"));
const Query = lazy(() => import("@/pages/Query"));
const ObjectDetection = lazy(() => import("@/pages/ObjectDetection"));
const ChangeDetection = lazy(() => import("@/pages/ChangeDetection"));
const LandCover = lazy(() => import("@/pages/LandCover"));
const Measurements = lazy(() => import("@/pages/Measurements"));
const Projects = lazy(() => import("@/pages/Projects"));
const Reports = lazy(() => import("@/pages/Reports"));
const Settings = lazy(() => import("@/pages/Settings"));
const Help = lazy(() => import("@/pages/Help"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function RouteFallback() {
  return (
    <div className="space-y-4 p-2">
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}

function App() {
  return (
    // `reducedMotion="user"` makes every motion component respect the OS
    // setting without per-component checks.
    <ErrorBoundary>
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* The landing page owns the full viewport and its own nav. */}
            <Route path="/" element={<Landing />} />

            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<Overview />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/query" element={<Query />} />
              <Route path="/object-detection" element={<ObjectDetection />} />
              <Route path="/change-detection" element={<ChangeDetection />} />
              <Route path="/land-cover" element={<LandCover />} />
              <Route path="/measurements" element={<Measurements />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/help" element={<Help />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </MotionConfig>
    </ErrorBoundary>
  );
}

export default App;
