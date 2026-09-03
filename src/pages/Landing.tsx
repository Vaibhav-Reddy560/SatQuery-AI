import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight, Sparkles, ScanSearch, GitCompareArrows, Layers,
  Ruler, Globe2, Satellite, Waypoints, Image as ImageIcon, MapPin,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { EarthConsole } from "@/components/hero/EarthConsole";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Num } from "@/components/ui/Num";
import { Bento, BentoTile } from "@/components/ui/Bento";
import { HudFrame } from "@/components/ui/HudFrame";
import { Readout } from "@/components/ui/Readout";
import { ScanSweep } from "@/components/ui/ScanSweep";
import { Reticle } from "@/components/ui/Reticle";
import { BootSequence } from "@/components/ui/BootSequence";
import { TelemetryTicker } from "@/components/ui/TelemetryTicker";
import { useAppStore } from "@/store/useAppStore";
import { dashboardStats } from "@/data/mockData";
import { fadeRise, stagger, ease, inView } from "@/lib/motion";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Find all water bodies near Mumbai",
  "What changed here since 2024?",
  "Classify land cover in Punjab",
  "Detect solar farms in Rajasthan",
];

const BOOT_LINES = [
  "ORBITAL LINK ......... OK",
  "SENSOR ARRAY .......... OK",
  "VISION MODEL ........... READY",
  "4 CAPABILITIES ONLINE",
];

/** One plausible scan target per suggestion — not real geo-projection
    (the globe rotates independently), just a spread across the visible
    face so hovering a different prompt visibly moves the scan. */
const SCAN_TARGETS = [
  { top: "55%", left: "36%" },
  { top: "50%", left: "58%" },
  { top: "30%", left: "48%" },
  { top: "64%", left: "42%" },
];

const TICKER_ITEMS = [
  "VEL 7.66 KM/S",
  "UPLINK STABLE",
  "ORBIT 14/16 REV",
  "SIGNAL -84 DBM",
  "SENSOR TEMP -12°C",
  "BATTERY 94%",
  "AOS +00:04:12",
  "ALT 512 KM",
  "GPS LOCK: 3D FIX",
  "SOLAR ARRAY 100%",
  "ATTITUDE NOMINAL",
  "DOWNLINK 12.4 MBPS",
  "GROUND STATION: BENGALURU",
  "PAYLOAD: OPTICAL + SAR",
  "IMAGE BUFFER 62%",
  "NEXT PASS T-00:42:18",
  "THERMAL NOMINAL",
  "COMMS LINK: S-BAND",
];

const CAPABILITIES = [
  { to: "/query", icon: Sparkles, title: "Natural-language query", body: "Ask in plain English. The agent picks the model, runs it, and shows its working." },
  { to: "/object-detection", icon: ScanSearch, title: "Object detection", body: "Buildings, vehicles, vessels and infrastructure, grounded to the pixel." },
  { to: "/change-detection", icon: GitCompareArrows, title: "Bi-temporal change", body: "Compare two passes and quantify what appeared, vanished or shifted." },
  { to: "/land-cover", icon: Layers, title: "Land cover", body: "Segment vegetation, water, built-up and barren classes with area breakdowns." },
  { to: "/measurements", icon: Ruler, title: "Measurement", body: "Distance, area and perimeter drawn straight onto the imagery." },
  { to: "/explore", icon: Globe2, title: "Map workspace", body: "Pan, draw an area of interest, and query only what you selected." },
];

function LandingNav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50">
      {/* Same fix as the workspace `TopBar`: the `chrome` pill below is
          opaque but inset from this header's edges, so content scrolling
          up through that gap (and the margins beside the pill on wide
          viewports) showed through plainly until it hit the pill's hard
          edge. A full-bleed blur + darken scrim across the reserved strip
          softens it away first instead of a sharp cutoff. */}
      <div className="absolute inset-0 backdrop-blur-md bg-gradient-to-b from-bg-primary/70 to-bg-primary/0 pointer-events-none" />
      <div className="relative mx-auto max-w-[1400px] px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6">
        {/* A floating Y2K chrome dock rather than a flush, edge-to-edge bar —
            the shell/chrome layer's showpiece on this screen. */}
        <div className="chrome flex h-16 items-center gap-3 rounded-2xl px-3 sm:gap-8 sm:px-4 lg:px-6">
          <Link to="/" aria-label="SatQuery AI — home" className="shrink-0">
            <Logo size="nav" white />
          </Link>
          <div className="flex-1" />
          <Link to="/dashboard" className="shrink-0">
            {/* Dark rounded square button with white text and 3D bevel
                effect — matching the icon-button style exactly. The `bevel`
                utility provides the raised inset-shadow effect (white
                highlight top-left, black shadow bottom-right). Label hides
                below `sm:` at 390px. */}
            <button className="bevel flex items-center justify-center gap-2 rounded-lg bg-bg-hover text-white px-3 py-2.5 sm:px-4 transition-colors duration-150 hover:bg-bg-hover/80">
              <span className="hidden sm:inline text-sm font-medium">Open workspace</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const setQueryInput = useAppStore((s) => s.setQueryInput);
  const [value, setValue] = useState("");
  const [scanIndex, setScanIndex] = useState<number | null>(null);

  const submit = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setQueryInput(q);
    navigate("/query");
  };

  return (
    <div className="relative min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:rounded-md focus:bg-bg-elevated focus:px-4 focus:py-2 focus:text-body-sm focus:text-text-primary focus:shadow-modal"
      >
        Skip to content
      </a>
      <AmbientBackground />
      <LandingNav />

      <main id="main-content">
      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-[1400px] px-6 pt-32 pb-20 lg:pt-36 lg:pb-28">
        {/* `items-end`, not `items-center` — the two columns are different
            heights, so centring left the boot-log panel hanging below the
            console's lower edge. Bottom-aligning lands the console's shell
            and the boot log on the same baseline. Below `lg` the grid is a
            single column, where this is a no-op. */}
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-8 items-end">
          <motion.div variants={stagger(0.05, 0.07)} initial="hidden" animate="show">
            <motion.div variants={fadeRise} className="flex items-center gap-2.5 mb-7">
              {/* `bg-bg-hover`, matching the capability tiles' icon badges
                  below — that's the reference for "the black 3D button
                  style." The badge previously sat on `bg-bg-secondary/80`,
                  a darker fill the `bevel` highlight/shadow read against
                  much less clearly. */}
              <a
                href="https://www.sih.gov.in/sih2026PS"
                target="_blank"
                rel="noopener noreferrer"
                className="bevel inline-flex items-center gap-3 h-9 pl-3.5 pr-4 rounded-full bg-bg-hover transition-opacity duration-150 hover:opacity-80"
              >
                <Satellite className="h-4 w-4 text-white" />
                <Readout
                  items={[{ value: "ISRO" }, { value: "SIH 2026" }, { value: "PS 26167" }]}
                  className="text-[0.8125rem] !text-white [&_span]:text-white [&_span]:[text-shadow:none]"
                />
              </a>
            </motion.div>

            <motion.h1
              variants={fadeRise}
              className="text-[clamp(2.75rem,6vw,4.25rem)] leading-[1.02] tracking-[-0.015em] font-thin text-text-primary"
            >
              Ask Earth
              <br />
              <span className="holo-text font-semibold">anything.</span>
            </motion.h1>

            <motion.p
              variants={fadeRise}
              className="mt-6 max-w-[46ch] text-[1.0625rem] leading-[1.55] text-text-secondary"
            >
              A vision-language assistant for satellite imagery. Ask a question in
              plain English — SatQuery picks the right model, runs the analysis,
              and shows you exactly how it got there.
            </motion.p>

            {/* Composer. Simplified from an earlier pass that layered a
                3-stop gradient, a permanent glow ring, an inset highlight,
                AND a separate focus-within version of all three — one flat
                colour, one border, one plain shadow, and a plain `Button`
                instead of `ShimmerButton`'s travelling spark + gloss cap. */}
            <motion.div variants={fadeRise} className="mt-9 max-w-[30rem]">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(value);
                }}
                className="flex items-center gap-2 rounded-xl border border-border-glass bg-bg-tertiary py-1.5 pl-1.5 pr-2 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.8)] transition-colors duration-150 focus-within:border-atmos/60"
              >
                <Sparkles className="h-4 w-4 text-atmos ml-2.5 shrink-0" />
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Find all water bodies near Mumbai…"
                  aria-label="Ask a question about satellite imagery"
                  className="no-native-focus-ring flex-1 h-9 bg-transparent px-1 text-sm text-text-primary placeholder:text-text-secondary outline-none min-w-0"
                />
                {/* No `disabled` — that dropped the button to 40% opacity
                    (the base button styles' disabled state) whenever the
                    field was empty, which read as "the button has no
                    colour until you type." `submit()` already no-ops on
                    empty/whitespace input, so disabling the control added
                    no real protection, only the dimmed look. */}
                <Button type="submit" variant="primary" size="sm" className="rounded-full">
                  Ask <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              {/* Terminal-layer treatment: suggestions read as command lines,
                  not chips — text output convention, not shell chrome. */}
              <div className="mt-3.5 flex flex-col gap-1">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    onMouseEnter={() => setScanIndex(i)}
                    onMouseLeave={() => setScanIndex((cur) => (cur === i ? null : cur))}
                    onFocus={() => setScanIndex(i)}
                    onBlur={() => setScanIndex((cur) => (cur === i ? null : cur))}
                    className="group flex items-center gap-2 rounded-md px-3 py-2 text-left font-mono text-mono-sm text-text-muted transition-colors duration-150 hover:bg-bg-hover hover:text-phosphor"
                  >
                    <span aria-hidden="true" className="text-phosphor-dim group-hover:text-phosphor">
                      &gt;
                    </span>
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>

            <motion.div variants={fadeRise} className="mt-6 max-w-[30rem]">
              <BootSequence lines={BOOT_LINES} />
            </motion.div>
          </motion.div>

          {/* Earth — the HUD layer's showpiece, now framed as a game
              console: `EarthConsole` owns the `chrome` shell, the screen
              bezel, and the play/pause/zoom/speed controls that actually
              drive the scene. This component only supplies the HUD overlay
              dressing that sits over the screen — instrument frame,
              telemetry and the target-lock reticle — since the transient
              "scanning" reticle depends on `scanIndex`, page-level state
              tied to hovering a suggestion above. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, ease: ease.out, delay: 0.1 }}
            className="w-full max-w-[620px] mx-auto lg:mx-0"
          >
            <EarthConsole
              overlay={({ paused, speedLabel, zoomLabel }) => (
                <>
                  <ScanSweep />
                  <HudFrame
                    label="EARTH OBSERVATION"
                    readouts={{
                      "top-left": (
                        <Readout
                          items={[
                            { label: "REC", value: paused ? "PAUSED" : "LIVE" },
                            { label: "SPD", value: speedLabel },
                            { label: "ZM", value: zoomLabel },
                          ]}
                        />
                      ),
                      "bottom-left": <Readout items={[{ label: "ALT", value: "512 KM" }]} />,
                      "bottom-right": (
                        <Readout items={[{ label: "LAT", value: "19.076°" }, { label: "LON", value: "72.877°" }]} />
                      ),
                    }}
                  />
                  <Reticle
                    size={30}
                    label="SAT-01 · LOCKED"
                    style={{
                      // Rescaled for EarthConsole's 7% screen inset — these
                      // keep it anchored to the same relative point on the
                      // globe's surface instead of drifting into the
                      // margin the inset created.
                      top: "28%",
                      left: "72%",
                      animation: "reticle-lock 0.6s cubic-bezier(0.32,0.72,0,1) both, pulse-glow 2.4s ease-in-out 0.6s infinite",
                    }}
                  />

                  {/* A second, transient reticle — hovering (or focusing) a
                      suggestion above "scans" a different point on the
                      globe. `key` forces a remount per target so the
                      lock-on animation replays each time, instead of just
                      sliding to the new spot. */}
                  {scanIndex !== null && (
                    <Reticle
                      key={scanIndex}
                      size={22}
                      label="SCANNING"
                      style={{ ...SCAN_TARGETS[scanIndex], animation: "reticle-lock 0.35s cubic-bezier(0.32,0.72,0,1) both" }}
                    />
                  )}
                </>
              )}
            />
          </motion.div>
        </div>
      </section>

      {/* Full-bleed — deliberately NOT inside the `max-w-[1400px]` hero
          section above (or any padded container): a scrolling ticker
          strip reads as an instrument only if it actually runs edge to
          edge, the same way a real stock ticker or news chyron does.
          Pulled up with a negative top margin to cancel some of the
          hero section's own `pb-20 lg:pb-28` — otherwise the gap between
          the hero content and the ticker reads as too large. */}
      <TelemetryTicker items={TICKER_ITEMS} className="-mt-10 mb-8 lg:-mt-16" />

      {/* ── Stats + capabilities ───────────────────────────── */}
      {/* `chrome` throughout — shell/chrome is Y2K's layer, and one material
          across all ten tiles is what keeps this uniform. The old per-tile
          `glow` tone wash is dropped here on purpose: it was the same
          exercise that produced the grey-tag-next-to-blue-tag bug once
          already (four near-identical tints standing in for real
          distinction). One chrome finish reads as more consistent, not less
          designed. */}
      <section className="relative mx-auto max-w-[1400px] px-6 pb-24">
        {/* No card here — plain numbers, the same "no boxes, the numbers
            carry themselves" convention Overview's own headline metrics
            use, rebuilt with Overview's OWN explicit grid rather than the
            generic `Bento` column-span system: `Bento`'s responsive spans
            (`md:col-span-3` of a 6-col grid) put these four at two-per-row
            on medium screens with no guaranteed shared baseline between
            them, which is what read as "not aligned" once the card that
            used to enforce equal-height cells was removed. A plain 2/4-
            column grid — identical to Overview's — pins every number and
            label to the same row. Icons match the capability tiles below
            (same icon, same stat, reinforcing the two are the same data),
            for the "decorate it" ask without bringing back a box. */}
        <motion.div
          variants={stagger(0, 0.06)}
          initial="hidden"
          whileInView="show"
          viewport={inView}
          className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10 mb-16"
        >
          {[
            { label: "Images analysed", value: dashboardStats.totalImagesAnalyzed, icon: ImageIcon, tone: "text-accent" },
            { label: "Areas covered", value: dashboardStats.areasAnalyzed, icon: MapPin, tone: "text-atmos" },
            { label: "Objects detected", value: dashboardStats.objectsDetected, icon: ScanSearch, tone: "text-success" },
            { label: "Changes flagged", value: dashboardStats.changesDetected, icon: GitCompareArrows, tone: "text-warning" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <motion.div key={s.label} variants={fadeRise} className="flex flex-col items-center text-center">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={cn("h-4 w-4", s.tone)} />
                  <span className="font-mono text-label uppercase text-text-secondary">{s.label}</span>
                </div>
                <div className="text-metric font-bold leading-none holo-text">
                  <Num value={s.value} animate format="compact" />
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        <Bento>
          <BentoTile span={12} className="mt-6">
            <div className="flex items-center gap-2 text-label text-text-faint uppercase mb-3">
              <Waypoints className="h-3.5 w-3.5" />
              Capabilities
            </div>
            <h2 className="text-heading text-text-primary max-w-[24ch]">
              One question. The right model, chosen for you.
            </h2>
          </BentoTile>

          {/*
            Deliberately not links. Every one of these used to route to a
            page inside the same authenticated shell — from the reader's
            point of view that's six more ways to "go to the workspace" on
            a page that already has that CTA top-right and just above. Now
            they're what they actually are: a description of what the
            product does, not six more doors to the same room.
          */}
          {CAPABILITIES.map((c) => {
            const Icon = c.icon;
            return (
              <BentoTile key={c.to} span={4}>
                {/* Console-panel detailing — structural tells of hardware
                    rather than a colour wash: brushed-metal grain, a raised
                    top lip, a header strip with a vent grille + a live
                    status LED (mirroring the icon across the header, the
                    cut-corner line it replaces read as an unexplained
                    scratch rather than a hardware seam), a zone-divider
                    seam, and two recessed rivets at the base. The icon
                    badge itself is untouched. */}
                <Card variant="chrome" className="relative h-full overflow-hidden">
                  {/* Brushed-metal grain — a very fine diagonal repeat,
                      the texture a machined panel has under raking light.
                      Behind everything else. */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(115deg, transparent 0px, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 3px)",
                    }}
                  />
                  {/* Raised panel lip along the top edge. */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
                  />

                  <div className="relative flex h-full flex-col p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="bevel flex items-center justify-center w-10 h-10 rounded-md bg-bg-hover">
                        <Icon className="h-[1.125rem] w-[1.125rem] text-white" />
                      </span>

                      {/* Vent grille + status LED — the small cluster a
                          console's top panel carries next to its power
                          button: airflow slots and a live indicator. */}
                      <div aria-hidden="true" className="flex items-center gap-3">
                        <div className="flex flex-col gap-[3px]">
                          {[0, 1, 2, 3].map((i) => (
                            <span key={i} className="h-px w-4 bg-white/20" />
                          ))}
                        </div>
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-atmos/60" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-atmos shadow-[0_0_6px_1px_rgba(111,184,255,0.8)]" />
                        </span>
                      </div>
                    </div>

                    {/* Zone-divider seam — separates the header "display"
                        strip from the text "label plate" below it, the way
                        a console shell splits into panels rather than
                        reading as one flat surface. */}
                    <div aria-hidden="true" className="h-px w-full bg-white/8 mb-4" />

                    <h3 className="text-subheading text-text-primary mb-2">{c.title}</h3>
                    <p className="text-[0.8125rem] leading-[1.55] text-text-muted">{c.body}</p>
                  </div>

                  {/* Recessed rivets, base corners — the small screw-head
                      tells of an assembled panel rather than a flat card. */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-3 left-3 h-1.5 w-1.5 rounded-full bg-black/50 shadow-[inset_0_1px_1px_rgba(0,0,0,0.6),0_1px_0_0_rgba(255,255,255,0.06)]"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-3 right-3 h-1.5 w-1.5 rounded-full bg-black/50 shadow-[inset_0_1px_1px_rgba(0,0,0,0.6),0_1px_0_0_rgba(255,255,255,0.06)]"
                  />
                </Card>
              </BentoTile>
            );
          })}
        </Bento>
      </section>
      </main>

      <footer className="relative border-t border-border-subtle">
        {/* Padding doubles the nav's own `px-3 sm:px-4 lg:px-6` at each
            breakpoint — the nav bar's logo sits two padding layers deep
            (the outer header wrapper, then the chrome pill's own inset),
            so matching just one of those layers here left the footer logo
            (and this row's right edge) short of where the nav's actually
            falls. */}
        <div className="mx-auto max-w-[1400px] px-6 sm:px-8 lg:px-12 py-8 flex flex-col items-center gap-4 sm:grid sm:grid-cols-3 sm:gap-6">
          <Logo size="nav" white />
          <p className="font-mono text-mono-sm uppercase tracking-[0.08em] text-white text-center">
            Smart India Hackathon 2026
          </p>
          <p className="font-mono text-mono-sm uppercase tracking-[0.08em] text-white text-center sm:text-right">
            Problem statement 26167
          </p>
        </div>
      </footer>
    </div>
  );
}
