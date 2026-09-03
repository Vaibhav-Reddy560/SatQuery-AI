<div align="center">

# 🛰️ SatQuery

### Satellite Intelligence Platform

**An interactive vision-language assistant for remote sensing and satellite image analysis.**

Built for **SIH 2026** — Smart India Hackathon

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com)
[![MapLibre GL](https://img.shields.io/badge/MapLibre_GL-6-333?logo=maplibre)](https://maplibre.org)

</div>

---

## Overview

SatQuery is a **conversational satellite intelligence platform** that lets users explore satellite imagery, ask natural-language questions, detect objects, compare imagery over time, perform land-use analysis, measure areas, and generate reports — all through an intuitive dark-first dashboard.

> **Current status:** Live satellite-analysis backend (real NDVI / NDWI / land-cover over Sentinel-2 imagery) wired into the frontend, plus a ChatGPT-style conversational assistant powered by **Google Gemini** (optional free API key). When no key is configured every AI surface degrades gracefully to the deterministic demo engine, so the app always runs. Authentication is not yet connected.

---

## ✨ Key Features

### 🗺️ Interactive Map Workspace
- **MapLibre GL JS** powered map with raster tile layers
- Zoom, pan, fullscreen controls
- **Location search** via OpenStreetMap Nominatim (free, no API key)
- **Drawing tools** — rectangle, polygon, circle, freehand selection
- **Layer switching** — OSM, CartoDB Dark, CartoDB Light basemaps
- **Live cursor coordinates** display
- **Area selection** with approximate km² calculation

### 💬 Conversational Query Engine
- Natural-language intent recognition (regex-based, 11 intent types)
- **Mock analysis pipeline:** Query → Parser → Intent → Tool → Result → Response
- Recognized intents: object detection, water body detection, change detection, land cover classification, vegetation loss, deforestation, area/distance/perimeter measurement, crop health
- Processing spinner with intent label feedback
- Response attachments (image overlays, data cards) with confidence bars
- Suggested follow-up actions

### 📊 Dashboard Analytics
- Real-time stat cards (images analyzed, areas, objects, changes)
- Weekly activity bar chart, monthly trend area chart
- Workspace preview with quick navigation
- Activity timeline with status badges

### 🔍 Analysis Pages
| Page | Capabilities |
|------|-------------|
| **Object Detection** | Bounding box visualization, category filtering, confidence bars, detection table |
| **Change Detection** | Before/after comparison, change statistics, per-change confidence |
| **Land Cover** | Classification map, percentage breakdown, analysis summary |
| **Measurements** | Distance, area, perimeter tools with interactive canvas and history |
| **Projects** | Project cards with search, status filters, analysis counts |
| **Reports** | Report list with preview pane, simulated report content |

---

## 🏗️ Architecture

```
src/
├── components/
│   ├── layout/          # AppShell, Sidebar, Header
│   ├── map/             # MapCanvas, MapControls, LayerPanel, DrawingToolbar,
│   │                    # SearchBar, CoordinatesDisplay, SelectionOverlay
│   └── ui/              # Badge, Card, StatCard, StatusBadge, ConfidenceBar
├── pages/               # 11 route pages (Overview → NotFound)
├── services/
│   ├── queryParser.ts   # Intent recognition from natural language
│   ├── analysisTools.ts # Tool registry (maps intents → tools)
│   ├── analysisRunner.ts# Mock analysis implementations (9 tools)
│   └── queryEngine.ts   # Pipeline orchestrator
├── hooks/
│   └── useMapInteraction.ts  # Map state (cursor, draw tools, selection)
├── store/
│   └── useAppStore.ts   # Zustand global state
├── types/
│   ├── index.ts         # Domain types
│   ├── map.ts           # Map-specific types
│   └── query.ts         # Query pipeline types
├── data/
│   └── mockData.ts      # Realistic mock data (India-centric)
├── lib/
│   ├── utils.ts         # cn() utility
│   ├── format.ts        # Date formatting helpers
│   └── tileSources.ts   # Tile source configuration
└── index.css            # Tailwind v4 with dark theme tokens
```

### Query Pipeline

```
User Query
    ↓
Query Parser (regex intent recognition)
    ↓
QueryIntent { type, location, centre, confidence }
    ↓
Tool Selection (registry lookup)
    ↓
Analysis Runner (mock implementation)
    ↓
AnalysisResult { detection | change | land_cover | measurement }
    ↓
Response Formatter → { markdown text, attachments, suggested actions }
    ↓
Chat UI (with processing indicator)
```

**Where real AI lives now:** The pipeline is hybrid. Conversational questions are answered directly by Gemini (`src/services/aiClient.ts` → backend `POST /api/v1/ai/chat`), and analysis intents run the real backend tools with the model rewriting the prose — grounded in the structured result so it never invents figures. When Gemini is unconfigured or unreachable, the deterministic parser/runner below is the fallback, so the `QueryIntent`/`AnalysisOutput` types stay the single contract for both paths.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/satquery.git
cd satquery

# Install dependencies
npm install

# Start development server
npm run dev
```

The app runs at **http://localhost:5173**

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run Oxlint |

---

## ⚙️ Configuration

### AI Assistant (Google Gemini)

The ChatGPT-style answers on the Query page, Explore's "Ask about this area", and the assistant panel on every analysis page are powered by the Gemini API.

1. Get a free API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Preferred — **backend** (key stays server-side):
   ```bash
   # backend/.env (or repo-root .env — the FastAPI settings loader picks it up)
   GOOGLE_API_KEY="your_key_here"
   GEMINI_MODEL="gemini-2.5-flash"
   ```
3. Or browser-only demo — **frontend** `.env` (no backend needed, dev only):
   ```bash
   VITE_GEMINI_API_KEY="your_key_here"
   VITE_GEMINI_MODEL="gemini-2.5-flash"
   ```

The assistant checks the backend first, then the browser key. Without either, the app runs fully offline: page assistants answer from local data briefings and the query page falls back to the deterministic demo engine. Check Settings → **AI assistant** for live status.

### Map Tile Sources

The app uses **free raster tiles** by default (CartoDB Dark) — no API key required.

To use a custom vector tile provider (MapTiler, Stadia, etc.):

```bash
# Create a .env file
echo 'VITE_MAP_STYLE_URL=https://api.maptiler.com/maps/your-style/style.json?key=YOUR_KEY' > .env
```

Supported tile sources (built-in, no key needed):
- **CartoDB Dark** (default) — dark basemap matching the UI theme
- **CartoDB Light** — light alternative
- **OpenStreetMap** — standard OSM tiles

---

## 🎨 Design System

### Dark-First Interface

| Token | Value | Usage |
|-------|-------|-------|
| `bg-primary` | `#0a0b0f` | Page background |
| `bg-secondary` | `#111318` | Cards, sidebar |
| `bg-tertiary` | `#181a22` | Input fields, elevated surfaces |
| `border-default` | `#2a2d38` | Card borders, dividers |
| `accent` | `#3b82f6` | Primary actions, links |
| `text-primary` | `#e8eaed` | Headings, important text |
| `text-secondary` | `#9ca3af` | Body text |
| `text-muted` | `#6b7280` | Labels, captions |

### Component Library

Reusable UI primitives in `src/components/ui/`:

- **Card** — `Card`, `CardHeader`, `CardContent`, `CardTitle`
- **Badge** — variants: `default`, `success`, `warning`, `danger`, `info`
- **StatusBadge** — automatic styling for analysis/project/report statuses
- **StatCard** — dashboard metric cards with trend indicators
- **ConfidenceBar** — color-coded confidence score visualization

---

## 🧩 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.2 |
| Language | TypeScript | 6.0 |
| Bundler | Vite | 8.2 |
| Styling | Tailwind CSS | 4.3 |
| State | Zustand | 5.0 |
| Routing | React Router | 7.18 |
| Maps | MapLibre GL JS | 6.6 |
| Charts | Recharts | 3.10 |
| Icons | Lucide React | 1.37 |
| Utilities | clsx + tailwind-merge | — |

---

## 🗺️ Map Integration

### Architecture

```
MapCanvas (core MapLibre instance)
  ├── MapControls (zoom, fullscreen)
  ├── LayerPanel (base layers + overlays)
  ├── DrawingToolbar (selection tools)
  ├── SearchBar (Nominatim geocoding)
  ├── CoordinatesDisplay (cursor lat/lng)
  └── SelectionOverlay (GeoJSON polygon on map)
```

All map components are **isolated and reusable**. The `MapCanvas` exposes the MapLibre instance via a `onMapReady` callback and DOM helpers (`__satqueryMap.flyTo()`).

### Drawing & Selection

1. User selects a draw tool (rectangle, polygon, circle, freehand)
2. Clicks add points to the selection
3. Double-click finishes the selection
4. Selection renders as a dashed blue polygon on the map
5. Area is calculated via Haversine approximation
6. Selection info panel updates with km², centre coordinates, point count

---

## 📁 Project Structure Highlights

### Types (`src/types/`)

| File | Exports |
|------|---------|
| `index.ts` | `SatelliteImage`, `DetectedObject`, `ChangeDetectionResult`, `LandCoverResult`, `Measurement`, `Project`, `Report`, `QueryMessage`, `MapLayer` |
| `map.ts` | `TileSource`, `CursorCoordinates`, `DrawTool`, `SelectedArea`, `MapCanvasProps` |
| `query.ts` | `Query`, `QueryIntent`, `IntentType`, `AnalysisTool`, `AnalysisOutput`, `DetectionResult`, `ChangeResult`, `LandCoverResult`, `MeasurementResult`, `QueryResponse` |

### Mock Data (`src/data/mockData.ts`)

Realistic India-centric mock data:
- 6 satellite images across Mumbai, Delhi, Sundarbans, Punjab, Bangalore, Kerala
- 7 recent activities with timestamps and statuses
- Object detection results with 8 categories
- Change detection with 5 change types
- Land cover classifications (7 classes)
- 5 measurement records
- 6 projects, 4 reports
- 4 pre-seeded chat messages

### Services (`src/services/`)

| Module | Responsibility |
|--------|---------------|
| `queryParser.ts` | Regex-based intent recognition, location extraction from 20+ Indian cities |
| `analysisTools.ts` | Tool registry: 9 tools mapped to 11 intent types |
| `analysisRunner.ts` | Mock implementations producing deterministic fake results |
| `queryEngine.ts` | Pipeline orchestrator: parse → select → run → format |

---

## 🔧 Extending the App

### Adding a new analysis tool

1. Add a new `IntentType` in `src/types/query.ts`
2. Add regex patterns in `src/services/queryParser.ts`
3. Register the tool in `src/services/analysisTools.ts`
4. Implement the mock runner in `src/services/analysisRunner.ts`
5. Add response formatting in `src/services/queryEngine.ts`

### Adding a new page

1. Create `src/pages/NewPage.tsx`
2. Add route in `src/App.tsx`
3. Add nav item in `src/components/layout/Sidebar.tsx`
4. Add page title in `src/components/layout/Header.tsx`

### Connecting to real AI

Replace the parser and runner modules while keeping the types:

```typescript
// services/queryParser.ts — swap for LLM call
export async function parseQuery(raw: string): Promise<QueryIntent> {
  const response = await fetch("/api/parse", {
    method: "POST",
    body: JSON.stringify({ query: raw }),
  });
  return response.json();
}
```

---

## 📝 License

This project is built for **Smart India Hackathon 2026**. See your team's license for distribution terms.

---

<div align="center">

**Built with ❤️ for SIH 2026**

*SatQuery — Making satellite intelligence accessible through conversation*

</div>
