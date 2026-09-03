import { useCallback, useState } from "react";
import { Eye, EyeOff, Gauge, Pause, Play, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { EarthHero } from "./EarthHero";
import { cn, STEEL_BEZEL } from "@/lib/utils";

const ZOOM_STEPS = [1, 1.25, 1.5, 1.75, 2];
const SPEED_STEPS = [1, 2, 4];
const DEFAULT_ZOOM_INDEX = 0;
const DEFAULT_SPEED_INDEX = 0;

/**
 * One console control — same 3D bevel material as the nav's "Open
 * workspace" button and the capability tiles' icon badges (`bevel` +
 * `bg-bg-hover`), sized as a square icon button to read as hardware, not a
 * toolbar action.
 */
function ConsoleButton({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "bevel flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-bg-hover text-white transition-colors duration-150 hover:bg-bg-hover/70 active:translate-y-px disabled:opacity-40 disabled:pointer-events-none",
        active && "text-atmos"
      )}
    >
      <Icon className="h-[1.125rem] w-[1.125rem]" />
    </button>
  );
}

/** A small LED ladder — lit dots in `--color-atmos`, unlit dots a dim
    outline. Reads the console's step-based state (zoom/speed) as hardware
    telemetry rather than a number, echoing the light blue already used
    inside the screen (readouts, atmosphere rim, reticles). */
function LedLadder({ count, active }: { count: number; active: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full transition-all duration-150",
            i <= active ? "bg-atmos shadow-[0_0_6px_1px_rgba(111,184,255,0.85)]" : "bg-white/15"
          )}
        />
      ))}
    </div>
  );
}

/**
 * The Earth hero, reframed as a game-console shell: a `chrome` body — the
 * same material as the nav bar and the capability tiles below it, not a
 * new one — around a bezeled "screen" showing the WebGL scene, with a
 * beveled control deck underneath that actually drives it. Not a static
 * frame around a static animation: play/pause, zoom (buttons, the scroll
 * wheel, or a click-drag directly on the globe — the way a real device
 * would treat its screen as an input, not just a display), a speed cycle,
 * and a HUD visibility toggle. A thin LED ladder above the buttons reads
 * the zoom/speed step as hardware telemetry instead of a number, and the
 * screen bezel now carries a soft blue backlight glow — both pull the
 * same light blue used inside the screen (readouts, atmosphere rim,
 * reticles) out onto the console body itself, so the shell and the
 * imagery it frames read as one instrument instead of a plain case around
 * a window.
 *
 * The HUD overlay (ScanSweep / HudFrame / Reticles) stays composed by the
 * caller via the `overlay` render prop, since the transient scan reticle
 * depends on Landing's own suggestion-hover state — this component owns
 * the console shell and playback state, not the imagery's HUD dressing.
 * Playback state is passed through to the caller too, so it can surface
 * through the *existing* HudFrame readout slot instead of a second,
 * competing overlay system.
 */
export function EarthConsole({
  className,
  overlay,
}: {
  className?: string;
  overlay?: (state: {
    paused: boolean;
    speedLabel: string;
    zoomLabel: string;
    hudVisible: boolean;
  }) => React.ReactNode;
}) {
  const [paused, setPaused] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX);
  const [hudVisible, setHudVisible] = useState(true);

  const zoom = ZOOM_STEPS[zoomIndex];
  const speed = SPEED_STEPS[speedIndex];
  const speedLabel = `${speed}X`;
  const zoomLabel = `${zoom.toFixed(2).replace(/0$/, "").replace(/\.$/, "")}X`;

  const zoomIn = useCallback(() => setZoomIndex((i) => Math.min(i + 1, ZOOM_STEPS.length - 1)), []);
  const zoomOut = useCallback(() => setZoomIndex((i) => Math.max(i - 1, 0)), []);
  const cycleSpeed = useCallback(() => setSpeedIndex((i) => (i + 1) % SPEED_STEPS.length), []);
  const reset = useCallback(() => {
    setZoomIndex(DEFAULT_ZOOM_INDEX);
    setSpeedIndex(DEFAULT_SPEED_INDEX);
    setPaused(false);
    setHudVisible(true);
  }, []);

  // Scroll-to-zoom on the screen itself — a real console treats its screen
  // surface as an input, not just a display. Buttons stay as the
  // discoverable/keyboard/touch path; this is a bonus for a mouse.
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? -1 : 1;
    setZoomIndex((i) => Math.min(Math.max(i + dir, 0), ZOOM_STEPS.length - 1));
  }, []);

  return (
    <div className={cn("chrome relative rounded-2xl p-3", className)}>
      {/* Backlight — a soft blue wash behind the control deck, the same
          light blue the screen already uses, bleeding faintly out onto
          the case the way a device's under-glow would. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 bottom-0 h-24 rounded-full opacity-70 blur-2xl"
        style={{ background: "radial-gradient(ellipse at center, rgba(111,184,255,0.16), transparent 72%)" }}
      />

      {/* Screen — inset bezel, deliberately not flush with the console
          body (a real device's screen sits recessed behind glass, not
          level with the case). The outer blue ring/glow is the backlight
          catching the bezel edge; `cursor-grab` signals the globe itself
          can be dragged. */}
      <div
        onWheel={handleWheel}
        className="relative aspect-square w-full cursor-grab overflow-hidden rounded-lg bg-bg-primary shadow-[inset_0_2px_14px_rgba(0,0,0,0.65),inset_0_0_0_1px_rgba(0,0,0,0.5),0_0_28px_-6px_rgba(111,184,255,0.45)] active:cursor-grabbing"
        style={{ border: STEEL_BEZEL }}
      >
        <EarthHero className="absolute inset-[7%]" userPaused={paused} speed={speed} zoom={zoom} />
        {hudVisible && overlay?.({ paused, speedLabel, zoomLabel, hudVisible })}
      </div>

      {/* Telemetry ladder — zoom/speed step, as hardware LEDs rather than
          a number. */}
      <div className="relative mt-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[0.625rem] uppercase tracking-wider text-white/40">Spd</span>
          <LedLadder count={SPEED_STEPS.length} active={speedIndex} />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[0.625rem] uppercase tracking-wider text-white/40">Zoom</span>
          <LedLadder count={ZOOM_STEPS.length} active={zoomIndex} />
        </div>
      </div>

      {/* Control deck. */}
      <div className="relative mt-2.5 flex items-center justify-center gap-2">
        <ConsoleButton
          icon={paused ? Play : Pause}
          label={paused ? "Resume orbit" : "Pause orbit"}
          onClick={() => setPaused((p) => !p)}
          active={paused}
        />
        <ConsoleButton icon={ZoomOut} label="Zoom out" onClick={zoomOut} disabled={zoomIndex === 0} />
        <ConsoleButton icon={ZoomIn} label="Zoom in" onClick={zoomIn} disabled={zoomIndex === ZOOM_STEPS.length - 1} />
        <ConsoleButton icon={Gauge} label={`Cycle speed — currently ${speedLabel}`} onClick={cycleSpeed} />
        <ConsoleButton
          icon={hudVisible ? Eye : EyeOff}
          label={hudVisible ? "Hide HUD overlay" : "Show HUD overlay"}
          onClick={() => setHudVisible((v) => !v)}
          active={!hudVisible}
        />
        <ConsoleButton icon={RotateCcw} label="Reset view" onClick={reset} />
      </div>
    </div>
  );
}
