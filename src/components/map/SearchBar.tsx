import { useState, useRef, useEffect, useCallback } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CursorCoordinates } from "@/types/map";

interface SearchResult {
  label: string;
  coords: CursorCoordinates;
}

interface SearchBarProps {
  /** Called when a location is selected */
  onLocationSelect?: (coords: CursorCoordinates, label: string) => void;
  className?: string;
}

/**
 * Floating location search bar.
 * Uses OpenStreetMap Nominatim for geocoding (free, no token needed).
 * Respects Nominatim usage policy with 1 request/second debounce.
 */
export function SearchBar({ onLocationSelect, className }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Geocode via Nominatim ─────────────────────────────
  const geocode = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q,
        format: "json",
        limit: "5",
        addressdetails: "1",
      });
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();

      setResults(
        data.map((item: any) => ({
          label: item.display_name,
          coords: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
        }))
      );
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => geocode(query), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, geocode]);

  const handleSelect = (result: SearchResult) => {
    setQuery(result.label.split(",").slice(0, 2).join(",").trim());
    setResults([]);
    setOpen(false);
    onLocationSelect?.(result.coords, result.label);
  };

  return (
    <div className={cn("relative", className)}>
      {/* `chrome` housing, not `glass edge-lit` — this was the only such
          surface on the page, next to a `chrome` toolbar, a `chrome` control
          cluster and `chrome` inspector cards. The field itself sits
          recessed into the shell (a thin inset shadow), the same "screen
          sunk into the console body" language the CRT panels elsewhere use,
          instead of a flat fill flush with the housing. Height dropped from
          `h-11` to the `h-9` every other control on this page uses. */}
      <div className="chrome rounded-lg p-1 shadow-overlay">
        <div
          className="flex items-center gap-2 h-9 px-3 rounded-md bg-bg-primary border border-transparent transition-colors duration-150 focus-within:border-accent/50"
          style={{ boxShadow: "inset 0 1px 3px rgba(0,0,0,0.6)" }}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 text-text-muted shrink-0 animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-text-muted shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search location..."
            className="no-native-focus-ring bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none flex-1 min-w-0"
            aria-label="Search location"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
          />
        </div>
      </div>

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-lg chrome shadow-overlay z-20 max-h-60 overflow-y-auto p-2">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => handleSelect(r)}
              className="flex items-start gap-2.5 w-full px-2.5 py-2 text-left rounded-md hover:bg-bg-hover transition-colors duration-150"
            >
              <MapPin className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <span className="text-body-sm text-text-secondary line-clamp-2">{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
