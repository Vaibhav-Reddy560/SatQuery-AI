<div align="center">

<img src="docs/readme/banner-hero.svg" width="100%" alt="SatQuery AI — Vision-Language Satellite Intelligence" />

<br />

[![Typing SVG](https://readme-typing-svg.demolab.com/?font=Space+Grotesk&weight=700&size=22&duration=2600&pause=900&color=3D7FFF&center=true&vCenter=true&width=760&height=50&lines=Ask+Earth+Anything.;Draw+an+area.+Query+only+that.;Detection+%C2%B7+Change+%C2%B7+Land+cover+%C2%B7+Measurement.;SIH+2026+-+Problem+Statement+SIH26167.)](https://github.com/Vaibhav-Reddy560/SatQuery-AI)

<br />

[![CI](https://github.com/Vaibhav-Reddy560/SatQuery-AI/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/Vaibhav-Reddy560/SatQuery-AI/actions/workflows/backend-ci.yml)
&nbsp;
![Status](https://img.shields.io/badge/status-hackathon_MVP-3D7FFF?style=for-the-badge&labelColor=0D1220)
&nbsp;
![Vercel](https://img.shields.io/badge/deployed_on-vercel-3D7FFF?style=for-the-badge&logo=vercel&logoColor=white&labelColor=0D1220)

<br />

<img src="https://skillicons.dev/icons?i=react,ts,vite,tailwind,threejs,fastapi,py,postgres,vercel,git&theme=dark" alt="tech stack icons" />

</div>

<br />

<div align="center">

**[Report a bug](../../issues)** &nbsp;·&nbsp; **[Request a feature](../../issues)** &nbsp;·&nbsp; **[Contents ↓](#contents)**

</div>

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0D1220,50:3D7FFF,100:0D1220" width="100%" alt="" />

## Overview

SatQuery is a **conversational satellite intelligence platform** that lets users explore satellite imagery, ask natural-language questions, detect objects, compare imagery over time, perform land-use analysis, measure areas, and generate reports — all through an intuitive dark-first dashboard.

> **Current status:** Live AI everywhere. The Query chat, Explore's "Ask about this area", and an assistant panel on every analysis page answer through **Google Gemini** (free tier), and analysis intents run the real backend satellite pipeline (NDVI / NDWI / land cover) with the model writing the reply prose grounded in the actual results. Without a Gemini key every surface degrades gracefully to the deterministic demo engine, so the app always runs. Authentication is not yet connected.

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

### 💬 Conversational Query Engine (live AI)
- **ChatGPT-style answers from Gemini** — conversational questions are answered by the model with full conversation history; analysis questions run the real pipeline and Gemini writes the reply prose grounded in the structured result (no invented figures)
- Natural-language intent recognition with district-level geocoding (11 intent types)
- Recognized intents: object detection, water body detection, change detection, land cover classification, vegetation loss, deforestation, area/distance/perimeter measurement, crop health
- Real satellite analyses from the FastAPI backend — Sentinel-2 NDVI vegetation health, NDWI water mapping, delta-NDVI change detection and ML land-cover classification with raster overlays
- Deterministic demo-engine fallback when no backend or Gemini key is configured
- Processing spinner with intent label feedback, response attachments and suggested follow-ups

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
│   ├── ai/              # AssistantPanel — embeddable ChatGPT-style panel
│   └── ui/              # Badge, Card, StatCard, StatusBadge, ConfidenceBar
├── pages/               # 12 route pages (Overview → NotFound)
├── services/
│   ├── queryParser.ts   # Intent recognition + district geocoding
│   ├── analysisTools.ts # Tool registry (maps intents → tools)
│   ├── analysisRunner.ts# Mock analysis implementations (9 tools)
│   ├── queryEngine.ts   # Hybrid orchestrator (live AI + deterministic fallback)
│   ├── aiClient.ts      # Gemini transport: backend /ai/chat → browser key
│   ├── aiPrompts.ts     # Shared assistant system prompts
│   └── pageAssistants.ts# Per-page grounded context for embedded assistants
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

**Where real AI lives now:** The engine is hybrid. Conversational questions go straight to Gemini (`src/services/aiClient.ts` → backend `POST /api/v1/ai/chat`); analysis intents run the backend tools and the model rewrites the summary prose grounded in the structured `AnalysisOutput`, so the `QueryIntent`/`AnalysisOutput` contract stays the single interface for both paths.

---

## 🚀 Getting Started

### Frontend

```bash
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

### Map Tile Sources

The app uses **free raster tiles** by default (CartoDB Dark) — no API key required.

To use a custom vector tile provider (MapTiler, Stadia, etc.):

```bash
npm run build       # tsc -b && vite build
npm run lint         # oxlint
npm run preview     # preview the production build
```

### Backend

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

python scripts/init_db.py          # create + seed the database
uvicorn backend.app.main:app --reload   # http://localhost:8000
```

```bash
pytest backend/tests/               # API test suite
python scripts/eval_vrsbench.py    # VRSBench evaluation harness
```

### AI Assistant (Gemini)

The ChatGPT-style answers everywhere are powered by the Gemini API. Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey), then either:

```bash
# backend (preferred — key stays server-side)
GOOGLE_API_KEY="your_key_here"
GEMINI_MODEL="gemini-2.5-flash"
```

or, for a browser-only demo with no backend running:

```bash
VITE_GEMINI_API_KEY="your_key_here"
VITE_GEMINI_MODEL="gemini-2.5-flash"
```

The assistant checks the backend first, then the browser key. Without either it runs fully offline (page assistants answer from local data briefings; the query page uses the demo engine). Check **Settings → AI assistant** for live status.

### Environment variables

Copy `.env.example` to `.env` and fill in what you need. Everything has a working local default — nothing above is required just to run the app.

| Variable | Used by | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | Frontend | Backend origin. Relative (`/api/v1`) when both are on one Vercel domain. |
| `VITE_MAP_STYLE_URL` | Frontend | Optional custom vector basemap; defaults to a keyless Esri raster basemap. |
| `DATABASE_URL` | Backend | Defaults to local SQLite; needs a real Postgres URL in production. |
| `SECRET_KEY` | Backend | JWT signing key — generate your own, never reuse the example value. |

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0D1220,50:3D7FFF,100:0D1220" width="100%" alt="" />

## Deployment

The repo ships with a `vercel.json` configured for [Vercel Services](https://vercel.com/docs/services) — one project, two independently-built services on a shared domain:

```json
{
  "services": {
    "frontend": { "root": ".", "framework": "vite" },
    "backend": { "root": "backend", "entrypoint": "app.main:app" }
  }
}
```

Import the repo on Vercel, attach a Postgres database (Neon, via the Marketplace) as `DATABASE_URL`, set a fresh `SECRET_KEY`, and deploy.

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0D1220,50:3D7FFF,100:0D1220" width="100%" alt="" />

## Roadmap

- [ ] Swap the mock inference engine for a trained vision-language model behind the existing `/api/v1/query` contract
- [ ] Real Sentinel-1/Sentinel-2 tile ingestion in place of reference imagery
- [ ] Authenticated multi-user projects with persisted history
- [ ] Async job queue for long-running analyses

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0D1220,50:3D7FFF,100:0D1220" width="100%" alt="" />

## Team

Built for **Smart India Hackathon 2026** by:

<div align="center">

<table>
<tr>
<td align="center">
<a href="https://github.com/Vaibhav-Reddy560"><img src="https://github.com/Vaibhav-Reddy560.png" width="72" style="border-radius:50%" /><br /><strong>Vaibhav-Reddy560</strong></a><br />Frontend & design system
</td>
<td align="center">
<a href="https://github.com/Lochanchennur"><img src="https://github.com/Lochanchennur.png" width="72" style="border-radius:50%" /><br /><strong>Lochanchennur</strong></a><br />Backend & MLOps
</td>
<td align="center">
<a href="https://github.com/CalmOutlaws"><img src="https://github.com/CalmOutlaws.png" width="72" style="border-radius:50%" /><br /><strong>CalmOutlaws</strong></a><br />Backend & MLOps
</td>
</tr>
</table>

</div>

<br />

<div align="center">
<img src="docs/readme/banner-footer.svg" width="100%" alt="" />

*SatQuery AI — making satellite intelligence accessible through conversation.*

</div>
