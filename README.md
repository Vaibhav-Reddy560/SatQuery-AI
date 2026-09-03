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

> **Current status:** Frontend product template with mock analysis engine. AI, satellite APIs, authentication, and backend are not yet connected.

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

**Swapping to real AI:** Replace `queryParser.ts` with an LLM API call, replace `analysisRunner.ts` with actual satellite analysis APIs. The `QueryIntent` and `AnalysisOutput` types stay the same — the rest of the pipeline doesn't change.

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
