import { create } from "zustand";
import type { MapLayer } from "@/types";
import { defaultMapLayers } from "@/data/mockData";

interface AppState {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Map
  mapLayers: MapLayer[];
  toggleMapLayer: (layerId: string) => void;
  mapCenter: { lat: number; lng: number };
  mapZoom: number;
  setMapCenter: (center: { lat: number; lng: number }) => void;
  setMapZoom: (zoom: number) => void;

  // Query
  queryInput: string;
  setQueryInput: (input: string) => void;

  // Search
  globalSearchOpen: boolean;
  setGlobalSearchOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Sidebar
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // Map
  mapLayers: defaultMapLayers,
  toggleMapLayer: (layerId) =>
    set((s) => ({
      mapLayers: s.mapLayers.map((l) =>
        l.id === layerId ? { ...l, visible: !l.visible } : l
      ),
    })),
  mapCenter: { lat: 20.5937, lng: 78.9629 }, // India center
  mapZoom: 5,
  setMapCenter: (center) => set({ mapCenter: center }),
  setMapZoom: (zoom) => set({ mapZoom: zoom }),

  // Query
  queryInput: "",
  setQueryInput: (input) => set({ queryInput: input }),

  // Search
  globalSearchOpen: false,
  setGlobalSearchOpen: (open) => set({ globalSearchOpen: open }),
}));
