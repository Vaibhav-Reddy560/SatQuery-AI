import { useId } from "react";
import { HudFrame } from "./HudFrame";
import { cn, STEEL_BEZEL } from "@/lib/utils";

/**
 * The sidebar's instrument panel — a detailed Earth-observation satellite
 * turning slowly in orbit, filling the dead space the nav list leaves
 * above "Back to site".
 *
 * Deliberately NOT the three.js hero: `EarthScene` is a ~225KB lazy chunk,
 * and this sits in the persistent sidebar shell mounted on every route.
 * It is plain SVG + CSS instead, but drawn as the *same vehicle* as the
 * satellite orbiting on the landing page — the part list and proportions
 * come from `EarthScene.tsx`'s `Satellite` (bus, MLI wrap, solar booms and
 * wings at ~8x bus width, dish + boom + feed horn, whip antenna, beacon
 * LED, thruster), and the cell grid matches its `useSolarCellTexture` at
 * 10 columns x 3 rows.
 *
 * Drawn with a light source at upper-left: every box shows a lit top face,
 * a mid-tone front face and a shaded right face. That shading, not the
 * outline count, is what makes it read as hardware — a first pass drew
 * everything as flat outlines and looked like a blueprint.
 *
 * Colour: `--color-atmos` (#6fb8ff), matching the 3D model's emissive.
 * NOT `--color-phosphor` (#4deeff) — that cyan is the terminal type layer,
 * used here only for the HUD readouts.
 *
 * The 3D read is real: `sat-yaw` rotates the flat drawing against a
 * `perspective` on its host, so the wings foreshorten through the turn.
 * Reduced motion needs no handling — the global rule in index.css
 * collapses every animation in the app to 0.01ms.
 */

const ATMOS = "var(--color-atmos)";
/** Structural highlight, from EarthScene's solar-panel frame colour. */
const LIT = "rgba(159,201,255,0.9)";

/** Fixed, not random — a stable starfield rather than one that reshuffles
    on every re-render. Percentages within one tile. */
const STARS = [
  { x: 14, y: 8, r: 1.4, o: 0.9 },
  { x: 76, y: 14, r: 1, o: 0.5 },
  { x: 31, y: 21, r: 1, o: 0.45 },
  { x: 84, y: 33, r: 1.3, o: 0.75 },
  { x: 9, y: 41, r: 1, o: 0.5 },
  { x: 67, y: 52, r: 1, o: 0.4 },
  { x: 23, y: 61, r: 1.3, o: 0.8 },
  { x: 88, y: 67, r: 1, o: 0.5 },
  { x: 41, y: 77, r: 1, o: 0.45 },
  { x: 78, y: 85, r: 1.2, o: 0.65 },
  { x: 16, y: 91, r: 1, o: 0.5 },
  { x: 55, y: 96, r: 1, o: 0.55 },
];

function StarLayer({ offset }: { offset?: boolean }) {
  return (
    <div
      className={cn("absolute inset-x-0 h-full", offset ? "-top-full" : "top-0")}
      style={{ animation: "star-drift 44s linear infinite" }}
    >
      {STARS.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.r, height: s.r, opacity: s.o }}
        />
      ))}
    </div>
  );
}

/**
 * One solar wing: three hinged segments on a boomed yoke, each ruled into
 * cells, with a lit leading edge and a shaded trailing edge.
 * `dir` is +1 for the starboard wing, -1 for port.
 */
function Wing({ dir, cells }: { dir: 1 | -1; cells: string }) {
  const SEG = 25;
  const GAP = 3;
  const root = 120 + dir * 30; // bus edge
  const boomEnd = root + dir * 14;

  return (
    <g>
      {/* Yoke boom + solar array drive assembly */}
      <line x1={root} y1={124} x2={boomEnd} y2={124} stroke={ATMOS} strokeWidth={2} />
      <line x1={root} y1={124} x2={boomEnd} y2={124} stroke={LIT} strokeWidth={0.7} />
      <circle cx={boomEnd} cy={124} r={4} fill="rgba(111,184,255,0.25)" stroke={ATMOS} strokeWidth={0.9} />
      <circle cx={boomEnd} cy={124} r={1.4} fill={LIT} />

      {/* Only the arrays track — the boom and the drive above stay put,
          the way the real hinge does. `view-box` transform-box so the
          origin resolves in SVG user units, on the boom axis. */}
      <g
        style={{
          transformBox: "view-box",
          transformOrigin: "120px 124px",
          animation: "sat-array-track 19s ease-in-out infinite",
        }}
      >
      {[0, 1, 2].map((i) => {
        const near = boomEnd + dir * (4 + i * (SEG + GAP));
        const x = dir === 1 ? near : near - SEG;
        return (
          <g key={i}>
            {/* Cells */}
            <rect x={x} y={86} width={SEG} height={76} fill={`url(#${cells})`} />
            {/* Frame — lit on top, shaded underneath */}
            <rect x={x} y={86} width={SEG} height={76} fill="none" stroke={ATMOS} strokeWidth={0.9} />
            <line x1={x} y1={86.5} x2={x + SEG} y2={86.5} stroke={LIT} strokeWidth={0.9} />
            <line x1={x} y1={161.5} x2={x + SEG} y2={161.5} stroke="#071633" strokeWidth={1} opacity={0.8} />
            {/* Mid spar */}
            <line x1={x} y1={124} x2={x + SEG} y2={124} stroke={LIT} strokeWidth={0.5} opacity={0.5} />

            {/* Hinge knuckles between segments */}
            {i < 2 && (
              <g>
                <line
                  x1={dir === 1 ? x + SEG : x}
                  y1={95}
                  x2={dir === 1 ? x + SEG + GAP : x - GAP}
                  y2={95}
                  stroke={ATMOS}
                  strokeWidth={1}
                />
                <line
                  x1={dir === 1 ? x + SEG : x}
                  y1={153}
                  x2={dir === 1 ? x + SEG + GAP : x - GAP}
                  y2={153}
                  stroke={ATMOS}
                  strokeWidth={1}
                />
                <circle cx={dir === 1 ? x + SEG + GAP / 2 : x - GAP / 2} cy={95} r={1.3} fill={LIT} />
                <circle cx={dir === 1 ? x + SEG + GAP / 2 : x - GAP / 2} cy={153} r={1.3} fill={LIT} />
              </g>
            )}
          </g>
        );
      })}
      </g>
    </g>
  );
}

function Satellite() {
  // Per-instance ids — this can mount more than once.
  const uid = useId().replace(/:/g, "");
  const cells = `sc-cells-${uid}`;
  const glow = `sc-glow-${uid}`;
  const front = `sc-front-${uid}`;
  const side = `sc-side-${uid}`;
  const deck = `sc-deck-${uid}`;
  const dishFace = `sc-dish-${uid}`;
  const barrel = `sc-barrel-${uid}`;

  return (
    // `overflow: visible` because the downlink arcs expand past the top of
    // the viewBox by design — it lets them run on into the container's own
    // top padding instead of being cut off a few units above the dish. The
    // panel's `overflow-hidden` is what finally clips them, and HudFrame
    // paints after this, so its label stays on top of them.
    <svg
      viewBox="0 0 240 320"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      style={{ overflow: "visible" }}
    >
      <defs>
        {/* Solar cells — 10 columns x 3 rows across the full wing,
            matching EarthScene's canvas texture (base #0b2258, seams
            atmos @ 0.65). A pattern, not hundreds of rects. */}
        <pattern id={cells} x="0" y="0" width={7} height={25.33} patternUnits="userSpaceOnUse">
          <rect width={7} height={25.33} fill="#0b2258" />
          <path d={`M ${7} 0 V 25.33 M 0 25.33 H ${7}`} fill="none" stroke="rgba(111,184,255,0.6)" strokeWidth={0.5} />
        </pattern>

        {/* Lit from upper-left: front face mid-tone, top deck bright,
            right flank in shadow. */}
        <linearGradient id={front} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5f8fd8" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#2c4a86" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#132a55" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={deck} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#cfe4ff" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#6f9ad8" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id={side} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#25406f" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#0d1c39" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={barrel} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7ba6e6" stopOpacity="0.5" />
          <stop offset="40%" stopColor="#2c4a86" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#0f2144" stopOpacity="0.6" />
        </linearGradient>
        {/* Concave dish: bright along the lit rim, falling into shadow
            toward the bowl's far side. */}
        <radialGradient id={dishFace} cx="0.34" cy="0.3" r="0.85">
          <stop offset="0%" stopColor="#dbe9ff" stopOpacity="0.5" />
          <stop offset="55%" stopColor="#4a76c4" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0d1c39" stopOpacity="0.6" />
        </radialGradient>

        {/* One filter, on one group — a per-shape or per-frame filter
            would re-rasterise through the whole 3D turn. */}
        <filter id={glow} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.4" floodColor="#6fb8ff" floodOpacity="0.5" />
        </filter>

      </defs>

      <g filter={`url(#${glow})`}>
        {/* ── Solar wings ─────────────────────────────────────────── */}
        <Wing dir={-1} cells={cells} />
        <Wing dir={1} cells={cells} />

        {/* ── High-gain dish. Canted off-axis so it reads as pointing
               somewhere, and on its own group so `sat-gimbal` can steer
               it independently of the bus. ────────────────────────── */}
        <g style={{ transformOrigin: "120px 50px", animation: "sat-gimbal 13s ease-in-out infinite" }}>
          <g transform="rotate(-12 120 32)">
            {/* Downlink wavefronts leaving the dish along boresight.
                Behind the reflector in paint order so they emerge from
                its face rather than sitting on top of it. */}
            <g style={{ transformBox: "view-box", transformOrigin: "120px 30px" }}>
              {[0, 1, 2].map((i) => (
                <path
                  key={i}
                  d="M 101 20 A 22 22 0 0 1 139 20"
                  fill="none"
                  stroke={ATMOS}
                  strokeWidth={1.2}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  style={{
                    transformBox: "view-box",
                    transformOrigin: "120px 30px",
                    animation: "sat-signal 4.2s ease-out infinite",
                    animationDelay: `${i * 1.4}s`,
                  }}
                />
              ))}
            </g>

            {/* Bowl */}
            <ellipse cx={120} cy={30} rx={31} ry={13} fill={`url(#${dishFace})`} stroke={ATMOS} strokeWidth={1.2} />
            {/* Lit rim arc, upper-left */}
            <path d="M 89 30 A 31 13 0 0 1 120 17" fill="none" stroke={LIT} strokeWidth={1.3} />
            {/* Ribs — only the four that would read on a concave face,
                stopped at the rim rather than crossing it. */}
            <g stroke={ATMOS} strokeWidth={0.45} opacity={0.5}>
              <line x1={120} y1={30} x2={92} y2={26} />
              <line x1={120} y1={30} x2={148} y2={26} />
              <line x1={120} y1={30} x2={103} y2={41} />
              <line x1={120} y1={30} x2={137} y2={41} />
            </g>
            <ellipse cx={120} cy={30} rx={9} ry={4} fill="none" stroke={ATMOS} strokeWidth={0.5} opacity={0.6} />
            {/* Tripod struts to the feed at the focus */}
            <path d="M 97 25 L 120 10 M 143 25 L 120 10 M 120 40 L 120 10" fill="none" stroke={ATMOS} strokeWidth={0.55} opacity={0.7} />
            {/* Feed horn */}
            <path d="M 116 11 L 124 11 L 122 3 L 118 3 Z" fill="rgba(159,201,255,0.55)" stroke={LIT} strokeWidth={0.6} />
          </g>
          {/* Two-axis gimbal, then a proper mast down to the deck —
              lengthened so the dish stands clear of the bus rather than
              sitting straight on it. */}
          <path d="M 113 42 L 113 50 M 127 42 L 127 50" fill="none" stroke={ATMOS} strokeWidth={0.8} />
          <circle cx={120} cy={50} r={2.6} fill="rgba(111,184,255,0.3)" stroke={ATMOS} strokeWidth={0.9} />
          <line x1={120} y1={52} x2={120} y2={70} stroke={ATMOS} strokeWidth={2.2} />
          <line x1={119} y1={52} x2={119} y2={70} stroke={LIT} strokeWidth={0.6} />
          {/* Mast collar where it lands on the deck */}
          <rect x={115} y={66} width={10} height={4} rx={1} fill="rgba(111,184,255,0.35)" stroke={ATMOS} strokeWidth={0.6} />
        </g>

        {/* ── Bus, as a lit box: top deck, front face, shaded flank ── */}
        {/* Top deck (parallelogram — the box's lid, catching the light) */}
        <path d="M 90 70 L 150 70 L 156 62 L 96 62 Z" fill={`url(#${deck})`} stroke={ATMOS} strokeWidth={0.9} />
        {/* Shaded right flank */}
        <path d="M 150 70 L 156 62 L 156 156 L 150 166 Z" fill={`url(#${side})`} stroke={ATMOS} strokeWidth={0.8} />
        {/* Front face */}
        <rect x={90} y={70} width={60} height={96} fill={`url(#${front})`} stroke={ATMOS} strokeWidth={1.1} />
        {/* Lit left edge */}
        <line x1={90.6} y1={70} x2={90.6} y2={166} stroke={LIT} strokeWidth={0.9} />

        {/* MLI blanket quilting — the insulation, not structural lines */}
        <g stroke="#9fc9ff" strokeWidth={0.35} opacity={0.28} fill="none">
          {[82, 94, 106, 118, 130, 142, 154].map((y) => (
            <line key={y} x1={92} y1={y} x2={148} y2={y} />
          ))}
          {[104, 118, 132].map((x) => (
            <line key={x} x1={x} y1={72} x2={x} y2={164} />
          ))}
        </g>

        {/* Radiator panel + heat pipes, on the shaded side */}
        <rect x={126} y={78} width={20} height={40} fill="rgba(13,28,57,0.55)" stroke={ATMOS} strokeWidth={0.7} />
        <g stroke="#9fc9ff" strokeWidth={0.4} opacity={0.55}>
          {[84, 90, 96, 102, 108, 114].map((y) => (
            <line key={y} x1={128} y1={y} x2={144} y2={y} />
          ))}
        </g>

        {/* Equipment hatch + fasteners */}
        <rect x={96} y={126} width={26} height={30} fill="rgba(111,184,255,0.08)" stroke={ATMOS} strokeWidth={0.7} />
        {[
          [99, 129],
          [119, 129],
          [99, 153],
          [119, 153],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={0.85} fill={LIT} opacity={0.8} />
        ))}
        {/* Module seam */}
        <line x1={90} y1={120} x2={150} y2={120} stroke={ATMOS} strokeWidth={0.9} opacity={0.85} />
        {/* Decal */}
        <rect x={128} y={126} width={16} height={6} fill="rgba(159,201,255,0.5)" />
        <g stroke="#071633" strokeWidth={0.7}>
          <line x1={130} y1={129} x2={142} y2={129} />
        </g>

        {/* Star trackers, on the deck rather than flanking the dish */}
        {[
          { x: 94, d: -1 },
          { x: 140, d: 1 },
        ].map((t) => (
          <g key={t.x}>
            <rect x={t.x} y={56} width={8} height={7} fill="rgba(111,184,255,0.3)" stroke={ATMOS} strokeWidth={0.7} />
            <path
              d={`M ${t.x + (t.d === 1 ? 8 : 0)} 57 l ${t.d * 6} -4 l 0 5 l ${-t.d * 6} 3 Z`}
              fill="rgba(13,28,57,0.6)"
              stroke={ATMOS}
              strokeWidth={0.5}
            />
          </g>
        ))}
        {/* Omni whip antennas */}
        <path d="M 96 62 L 84 44 M 150 62 L 162 44" fill="none" stroke={ATMOS} strokeWidth={0.55} opacity={0.8} />
        <circle cx={84} cy={44} r={0.9} fill={LIT} />
        <circle cx={162} cy={44} r={0.9} fill={LIT} />
        {/* Beacon */}
        <circle cx={145} cy={74} r={1.7} fill="#ffffff" style={{ animation: "pulse-glow 2.4s ease-in-out infinite" }} />

        {/* ── Telescope payload — a barrel with a lit left flank ───── */}
        <path d="M 102 166 L 138 166 L 133 232 L 107 232 Z" fill={`url(#${barrel})`} stroke={ATMOS} strokeWidth={1.1} />
        <line x1={102.8} y1={167} x2={107.8} y2={231} stroke={LIT} strokeWidth={0.9} />
        {/* Baffle stiffener rings */}
        <g stroke="#9fc9ff" strokeWidth={0.5} opacity={0.55}>
          {[
            [180, 103.1, 136.9],
            [194, 104.2, 135.8],
            [208, 105.2, 134.8],
            [222, 106.3, 133.7],
          ].map(([y, xa, xb]) => (
            <line key={y} x1={xa} y1={y} x2={xb} y2={y} />
          ))}
        </g>
        {/* Aperture — the optic looking down at Earth */}
        <ellipse cx={120} cy={233} rx={14} ry={4.6} fill="#04070f" stroke={ATMOS} strokeWidth={1} />
        <ellipse cx={120} cy={233} rx={9} ry={2.8} fill="none" stroke={ATMOS} strokeWidth={0.4} opacity={0.5} />
        <path d="M 108 232 A 12 3.6 0 0 1 118 230" fill="none" stroke={LIT} strokeWidth={0.8} />

        {/* ── Base / propulsion ───────────────────────────────────── */}
        {/* Separation ring at the launch-vehicle interface */}
        <path d="M 108 236 L 132 236 L 130 243 L 110 243 Z" fill="rgba(13,28,57,0.7)" stroke={ATMOS} strokeWidth={0.7} />
        {/* Main engine bell */}
        <path d="M 112 243 L 128 243 L 124 262 L 116 262 Z" fill="rgba(31,79,196,0.35)" stroke={ATMOS} strokeWidth={0.9} />
        <ellipse cx={120} cy={262} rx={4} ry={1.5} fill="#04070f" stroke={ATMOS} strokeWidth={0.6} />
        <g stroke="#9fc9ff" strokeWidth={0.4} opacity={0.4}>
          <line x1={117} y1={244} x2={117.6} y2={261} />
          <line x1={123} y1={244} x2={122.4} y2={261} />
        </g>

        {/* RCS thruster quads, at the bus corners */}
        {[
          { x: 90, y: 160, d: -1 },
          { x: 150, y: 160, d: 1 },
          { x: 90, y: 74, d: -1 },
          { x: 150, y: 74, d: 1 },
        ].map((t) => (
          <path
            key={`${t.x}-${t.y}`}
            d={`M ${t.x} ${t.y} l ${t.d * 5} -2.5 l 0 6 l ${-t.d * 5} -1.5 Z`}
            fill="rgba(159,201,255,0.4)"
            stroke={ATMOS}
            strokeWidth={0.5}
          />
        ))}
      </g>
    </svg>
  );
}

export function SatelliteScreen({ className }: { className?: string }) {
  return (
    <div
      className={cn("crt relative overflow-hidden rounded-lg bg-bg-primary", className)}
      style={{ border: STEEL_BEZEL }}
    >
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        <StarLayer />
        <StarLayer offset />
      </div>

      {/* Ambient bloom behind the vehicle, so it sits in light rather than
          being pasted onto the black. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 55% 45% at 50% 48%, rgba(111,184,255,0.14), transparent 70%)" }}
      />

      {/* Heavier top padding than bottom — this sits the vehicle low in
          the frame, clear of HudFrame's label, with the downlink waves
          breaking into the space above it. The body only translates;
          nothing scales it (an earlier `rotateY` rig read as the whole
          satellite pulsing). */}
      <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center px-4 pb-6 pt-14">
        <div
          className="h-full w-full"
          style={{ animation: "sat-float 9s ease-in-out infinite", willChange: "transform" }}
        >
          <Satellite />
        </div>
      </div>

      <HudFrame
        label="SAT-01 · NADIR LOCK"
        readouts={{ "bottom-left": "ALT 512 KM", "bottom-right": "INC 97.4°" }}
      />
    </div>
  );
}
