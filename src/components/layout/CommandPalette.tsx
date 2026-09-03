import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, CornerDownLeft, MapPin, Sparkles, ArrowRight,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Kbd } from "@/components/ui/Kbd";
import { PRIMARY, ANALYSIS, TRAILING, UTILITY } from "./navConfig";
import { cn } from "@/lib/utils";
import { ease, dur } from "@/lib/motion";

/**
 * ⌘K palette.
 *
 * The store already carried an "open" flag that nothing ever read — the old
 * header wrote it into the void. This is the consumer.
 */

type Item = {
  id: string;
  label: string;
  hint?: string;
  group: "Navigate" | "Ask" | "Fly to";
  icon: React.ComponentType<{ className?: string }>;
  run: (ctx: Ctx) => void;
};

interface Ctx {
  navigate: (to: string) => void;
  setQueryInput: (v: string) => void;
  setMapCenter: (c: { lat: number; lng: number }) => void;
  setMapZoom: (z: number) => void;
}

const ROUTES = [...PRIMARY, ...ANALYSIS, ...TRAILING, ...UTILITY];

const PROMPTS = [
  "Identify buildings in the selected region",
  "Find all water bodies near Mumbai",
  "Compare vegetation cover between 2024 and 2026",
  "What areas show the most urban expansion?",
  "Estimate the area of deforestation in Sundarbans",
  "Detect solar panel installations in Rajasthan",
  "Classify land cover in Punjab",
];

const PLACES: { name: string; lat: number; lng: number }[] = [
  { name: "Mumbai", lat: 19.076, lng: 72.8777 },
  { name: "Delhi", lat: 28.6139, lng: 77.209 },
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707 },
  { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
  { name: "Hyderabad", lat: 17.385, lng: 78.4867 },
  { name: "Sundarbans", lat: 21.9497, lng: 88.9 },
  { name: "Rann of Kutch", lat: 23.7337, lng: 70.8022 },
];

const ITEMS: Item[] = [
  ...ROUTES.map<Item>((r) => ({
    id: `nav:${r.to}`,
    label: r.label,
    group: "Navigate",
    icon: r.icon,
    run: (c) => c.navigate(r.to),
  })),
  ...PROMPTS.map<Item>((p) => ({
    id: `ask:${p}`,
    label: p,
    group: "Ask",
    icon: Sparkles,
    run: (c) => {
      c.setQueryInput(p);
      c.navigate("/query");
    },
  })),
  ...PLACES.map<Item>((p) => ({
    id: `go:${p.name}`,
    label: p.name,
    hint: `${p.lat.toFixed(2)}°, ${p.lng.toFixed(2)}°`,
    group: "Fly to",
    icon: MapPin,
    run: (c) => {
      c.setMapCenter({ lat: p.lat, lng: p.lng });
      c.setMapZoom(11);
      c.navigate("/explore");
    },
  })),
];

/** Subsequence match — "obdt" finds "Object Detection". */
function fuzzy(needle: string, haystack: string): boolean {
  if (!needle) return true;
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();
  if (h.includes(n)) return true;
  let i = 0;
  for (const ch of h) {
    if (ch === n[i]) i++;
    if (i === n.length) return true;
  }
  return false;
}

export function CommandPalette() {
  const { commandOpen, setCommandOpen, setQueryInput, setMapCenter, setMapZoom } = useAppStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => ITEMS.filter((i) => fuzzy(q, i.label)), [q]);

  const grouped = useMemo(() => {
    const map = new Map<Item["group"], Item[]>();
    for (const r of results) {
      if (!map.has(r.group)) map.set(r.group, []);
      map.get(r.group)!.push(r);
    }
    return [...map.entries()];
  }, [results]);

  // Global ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen(!commandOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commandOpen, setCommandOpen]);

  useEffect(() => {
    if (commandOpen) {
      setQ("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [commandOpen]);

  useEffect(() => setActive(0), [q]);

  // Keep the highlighted row in view as the user arrows through.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (item: Item) => {
    setCommandOpen(false);
    item.run({ navigate, setQueryInput, setMapCenter, setMapZoom });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % Math.max(results.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % Math.max(results.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[active];
      if (item) run(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setCommandOpen(false);
    }
  };

  let flatIndex = -1;

  return (
    <AnimatePresence>
      {commandOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: dur.fast }}
        >
          <div
            className="absolute inset-0 bg-bg-primary/70 backdrop-blur-sm"
            onClick={() => setCommandOpen(false)}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={{ duration: dur.base, ease: ease.apple }}
            className="relative w-full max-w-xl glass edge-lit rounded-lg overflow-hidden shadow-[0_40px_100px_-30px_rgba(0,0,0,0.95)]"
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-3 px-4 h-14 border-b border-border-glass">
              <Search className="h-4 w-4 text-text-muted shrink-0" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search pages, ask a question, or fly to a place…"
                className="no-native-focus-ring flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
                aria-label="Command palette search"
              />
              <Kbd>ESC</Kbd>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
              {results.length === 0 && (
                <div className="px-3 py-10 text-center">
                  <p className="text-sm text-text-secondary">No matches for “{q}”</p>
                  <p className="text-xs text-text-muted mt-1">Try a place, a page, or a question.</p>
                </div>
              )}

              {grouped.map(([group, items]) => (
                <div key={group} className="mb-2 last:mb-0">
                  <div className="px-3 py-1.5 text-label text-text-faint uppercase">{group}</div>
                  {items.map((item) => {
                    flatIndex += 1;
                    const idx = flatIndex;
                    const Icon = item.icon;
                    const isActive = idx === active;
                    return (
                      <button
                        key={item.id}
                        data-idx={idx}
                        onMouseMove={() => setActive(idx)}
                        onClick={() => run(item)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 h-10 rounded-md text-left transition-colors duration-100",
                          isActive ? "bg-accent-muted text-text-primary" : "text-text-secondary"
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-accent" : "text-text-muted")} />
                        <span className="flex-1 text-body-sm truncate">{item.label}</span>
                        {item.hint && (
                          <span className="text-[0.6875rem] tabular text-text-muted shrink-0">{item.hint}</span>
                        )}
                        {isActive && <CornerDownLeft className="h-3.5 w-3.5 text-text-muted shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 px-4 h-10 border-t border-border-glass text-[0.6875rem] text-text-faint">
              <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
              <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> select</span>
              <span className="ml-auto flex items-center gap-1.5">
                Powered by SatQuery <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
