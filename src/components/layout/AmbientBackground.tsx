/**
 * The space behind everything.
 *
 * v4: replaced the soft colour-wash blobs with thin orbital line-art —
 * directly lifted from the reference mood board's space-branding panel
 * (concentric/eccentric orbit rings, a small dot for the "planet" on each
 * path). It reads as graphic and technical rather than atmospheric, which
 * fits the new metallic/monochrome-blue direction, and it's a more literal
 * fit for a satellite app than a nebula ever was. Still no stars, no dot
 * grid, no noise — depth comes from the rings and, on the landing page,
 * from the Earth itself.
 *
 * v5: the large ring group used to sit top-right — directly behind the
 * landing page's Earth, competing with its own HUD frame and orbit path
 * for the same visual space. Moved to the top-left, clear of the Earth
 * entirely. Also recoloured from grey (`#4c4c51`/`#2c2c30`/`#78787e` — a
 * leftover from before the palette rebuild) to blue, and the orbit "dot"
 * markers gained an actual glow (a blurred radial-gradient halo behind the
 * dot) instead of being flat, dim circles.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden bg-bg-primary">
      <svg
        className="absolute -top-[8%] -left-[14%] w-[62vw] h-[62vw] max-w-[980px] max-h-[980px] opacity-[0.6]"
        viewBox="0 0 400 400"
        fill="none"
        style={{ animation: "orbit 150s linear infinite" }}
      >
        <defs>
          <radialGradient id="ambient-dot-glow">
            <stop offset="0%" stopColor="#6fb8ff" stopOpacity="0.85" />
            <stop offset="60%" stopColor="#3d7fff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3d7fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="200" cy="200" rx="190" ry="80" stroke="#3d7fff" strokeOpacity="0.28" strokeWidth="0.85" transform="rotate(-18 200 200)" />
        <ellipse cx="200" cy="200" rx="150" ry="150" stroke="#3d7fff" strokeOpacity="0.16" strokeWidth="0.85" />
        <ellipse cx="200" cy="200" rx="120" ry="48" stroke="#6fb8ff" strokeOpacity="0.4" strokeWidth="0.85" transform="rotate(24 200 200)" />
        <g transform="rotate(-18 200 200)">
          <circle cx="390" cy="200" r="16" fill="url(#ambient-dot-glow)" />
          <circle cx="390" cy="200" r="2.5" fill="#91caff" />
        </g>
        <g transform="rotate(24 200 200)">
          <circle cx="80" cy="248" r="11" fill="url(#ambient-dot-glow)" />
          <circle cx="80" cy="248" r="1.75" fill="#6fb8ff" />
        </g>
      </svg>

      <svg
        className="absolute -bottom-[20%] -left-[10%] w-[55vw] h-[55vw] max-w-[900px] max-h-[900px] opacity-[0.45]"
        viewBox="0 0 400 400"
        fill="none"
        style={{ animation: "orbit 200s linear infinite reverse" }}
      >
        <ellipse cx="200" cy="200" rx="170" ry="170" stroke="#3d7fff" strokeOpacity="0.16" strokeWidth="0.85" />
        <ellipse cx="200" cy="200" rx="130" ry="60" stroke="#6fb8ff" strokeOpacity="0.24" strokeWidth="0.85" transform="rotate(40 200 200)" />
        <g transform="rotate(40 200 200)">
          <circle cx="330" cy="200" r="10" fill="url(#ambient-dot-glow)" />
          <circle cx="330" cy="200" r="2" fill="#6fb8ff" />
        </g>
      </svg>

      {/* HUD/terminal texture — a fine technical grid plus CRT-style
          scanlines, sitting on this shared background layer (`-z-10`,
          behind every page) rather than on any individual image or block
          of text. This is what puts the terminal/HUD language on pages
          that otherwise carry none of it — previously only Query's own
          small `crt` terminal box had this texture anywhere in the
          workspace. Static, no flicker: an ambient page-wide texture
          reads as atmosphere; animating it everywhere would read as a
          screen fault. */}
      <div aria-hidden="true" className="absolute inset-0 hud-grid" />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(111,184,255,0.05) 0px, rgba(111,184,255,0.05) 1px, transparent 1px, transparent 3px)",
        }}
      />

      {/* Settles the field back toward the void so content stays legible. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(130% 90% at 60% 10%, transparent 0%, rgba(6,6,7,0.55) 60%, #060607 100%)",
        }}
      />
    </div>
  );
}
