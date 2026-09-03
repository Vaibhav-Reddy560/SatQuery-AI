import { create } from "zustand";

interface AppState {
  // Nav rail. Pinned = permanently expanded; otherwise it expands on hover
  // as an overlay, so the page never reflows.
  railPinned: boolean;
  toggleRail: () => void;

  // Map
  activeBaseLayer: string;
  setActiveBaseLayer: (id: string) => void;
  mapCenter: { lat: number; lng: number };
  mapZoom: number;
  setMapCenter: (center: { lat: number; lng: number }) => void;
  setMapZoom: (zoom: number) => void;

  // Query — carries a prompt from the landing page into /query
  queryInput: string;
  setQueryInput: (input: string) => void;

  // Command palette
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  railPinned: false,
  toggleRail: () => set((s) => ({ railPinned: !s.railPinned })),

  activeBaseLayer: "esriImagery",
  setActiveBaseLayer: (id) => set({ activeBaseLayer: id }),
  mapCenter: { lat: 20.5937, lng: 78.9629 }, // India
  mapZoom: 5,
  setMapCenter: (center) => set({ mapCenter: center }),
  setMapZoom: (zoom) => set({ mapZoom: zoom }),

  queryInput: "",
  setQueryInput: (input) => set({ queryInput: input }),

  commandOpen: false,
  setCommandOpen: (open) => set({ commandOpen: open }),
}));
