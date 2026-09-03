import { useEffect, useState } from "react";
import { Page, Section } from "@/components/layout/Page";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { TILE_SOURCES } from "@/lib/tileSources";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

/**
 * Each option re-points `--color-accent`/`--color-accent-hover` at another
 * semantic token pair already defined in `index.css`, instead of duplicating
 * their hex values here (the previous version hand-typed all 8 and would
 * have silently drifted from the real tokens the moment either changed).
 * "Orbit" is the one exception: it can't reference `--color-accent` itself
 * (that would be a circular custom-property assignment), so selecting it
 * just removes the override and lets the stylesheet's own default win.
 */
const ACCENTS = [
  { id: "orbit", label: "Orbit", colorVar: "--color-accent" },
  { id: "atmosphere", label: "Atmosphere", colorVar: "--color-atmos" },
  { id: "aurora", label: "Aurora", colorVar: "--color-success" },
  { id: "terra", label: "Terra", colorVar: "--color-warning" },
] as const;

function Row({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-5">
      <div className="min-w-0">
        <div className="text-body text-text-primary">{title}</div>
        {description && <p className="mt-1 text-body-sm text-text-muted">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function Settings() {
  const { activeBaseLayer, setActiveBaseLayer } = useAppStore();
  const [accent, setAccent] = useState("orbit");
  // "Orbit" swatch can't display `var(--color-accent)` live — this effect
  // is what overwrites that very property when another option is picked, so
  // the swatch would end up showing whichever accent is currently active
  // instead of its own colour. Captured once, before any override applies.
  const [orbitColor] = useState(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim()
  );
  const [labels, setLabels] = useState(true);
  const [autoRun, setAutoRun] = useState(false);
  const [trace, setTrace] = useState(true);

  // Rewriting the token at runtime re-skins the whole app — the clearest
  // demonstration that the design system is actually token-driven.
  useEffect(() => {
    const a = ACCENTS.find((x) => x.id === accent);
    if (!a) return;
    const root = document.documentElement;
    if (a.id === "orbit") {
      root.style.removeProperty("--color-accent");
      root.style.removeProperty("--color-accent-hover");
    } else {
      root.style.setProperty("--color-accent", `var(${a.colorVar})`);
      root.style.setProperty("--color-accent-hover", `var(${a.colorVar}-hover)`);
    }
  }, [accent]);

  return (
    <Page
      title="Settings"
      subtitle="Appearance, map defaults and how the analysis engine behaves."
    >
      <Section title="Appearance">
        <div className="divide-y divide-border-subtle">
          <Row title="Accent colour" description="Applies across the entire interface immediately.">
            <div className="flex items-center gap-2.5">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAccent(a.id)}
                  aria-label={a.label}
                  aria-pressed={accent === a.id}
                  className={cn(
                    "h-7 w-7 rounded-full transition-transform duration-150",
                    accent === a.id
                      ? "ring-2 ring-offset-2 ring-offset-bg-primary ring-text-primary scale-110"
                      : "hover:scale-105"
                  )}
                  style={{ backgroundColor: a.id === "orbit" ? orbitColor : `var(${a.colorVar})` }}
                />
              ))}
            </div>
          </Row>
          <Row title="Theme" description="SatQuery is designed for dark environments.">
            <span className="text-body-sm text-text-muted">Dark</span>
          </Row>
        </div>
      </Section>

      <Section title="Map">
        <div className="divide-y divide-border-subtle">
          <Row title="Default basemap" description="Used whenever a new workspace opens.">
            <Segmented
              size="sm"
              options={Object.values(TILE_SOURCES).map((t) => ({ value: t.id, label: t.name }))}
              value={activeBaseLayer}
              onChange={setActiveBaseLayer}
            />
          </Row>
          <Row title="Place labels" description="Show settlement and administrative names.">
            <Switch checked={labels} onChange={setLabels} label="Place labels" />
          </Row>
        </div>
      </Section>

      <Section title="Analysis">
        <div className="divide-y divide-border-subtle">
          <Row title="Run automatically" description="Execute the selected tool as soon as an area is drawn.">
            <Switch checked={autoRun} onChange={setAutoRun} label="Run automatically" />
          </Row>
          <Row title="Show agent trace" description="Surface the model, tool and parameters behind every answer.">
            <Switch checked={trace} onChange={setTrace} label="Show agent trace" />
          </Row>
        </div>
      </Section>

      <Section title="About">
        <dl className="divide-y divide-border-subtle">
          {[
            ["Problem statement", "26167 — Interactive Vision-Language Assistant"],
            ["Organisation", "ISRO · Department of Space"],
            ["Event", "Smart India Hackathon 2026"],
            ["Imagery", "Esri World Imagery · NASA Blue Marble"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-8 py-5">
              <dt className="font-mono text-body-sm uppercase text-text-primary">{k}</dt>
              <dd className="font-mono text-mono-sm text-text-muted text-right">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </Page>
  );
}
