<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&height=230&color=0:0D1220,35:212C44,70:354460,100:3D7FFF&text=SatQuery%20AI&fontColor=F2F2F4&fontSize=60&fontAlignY=34&desc=Vision-Language%20Satellite%20Intelligence&descAlignY=54&descSize=18&descAlign=50&animation=fadeIn&section=header" width="100%" alt="SatQuery AI" />

<img src="public/brand/satquery-icon-512.png" width="104" alt="SatQuery AI logo" />

<br /><br />

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

**SatQuery AI** is a conversational satellite-intelligence workspace — ask a question in plain English, draw an area of interest on the map, and get object detection, change detection, land-cover classification and measurements back as structured, explainable results.

Built for **Smart India Hackathon 2026** (Problem Statement **SIH26167**), it pairs a full interactive mapping dashboard with a FastAPI backend structured around real remote-sensing benchmarks (**BigEarthNet**, **VRSBench**), ready for a trained vision-language model to be dropped in behind the same API surface.

### How it works

```text
1. ASK       →  Type a question in plain English, or pick a suggestion.
2. DRAW      →  Optionally circle an area of interest on the live map.
3. ANALYZE   →  The agent parses intent, runs the right tool, scores confidence.
4. REVIEW    →  Get back a map overlay, a data table, and a plain-English summary.
```

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0D1220,50:3D7FFF,100:0D1220" width="100%" alt="" />

### Contents

[Features](#features) · [Design system](#design-system) · [Architecture](#architecture) · [Tech stack](#tech-stack) · [Getting started](#getting-started) · [Deployment](#deployment) · [Roadmap](#roadmap) · [Team](#team)

## Features

<table>
<tr>
<td width="33%" valign="top">

### 💬 Natural-language query
Ask in plain English. The agent parses intent, selects the right analysis tool, runs it, and shows its working — no dropdowns, no forms.

</td>
<td width="33%" valign="top">

### 🔍 Object detection
Buildings, vehicles, vessels, solar arrays and infrastructure, grounded to the pixel with confidence scores per feature.

</td>
<td width="33%" valign="top">

### 🔀 Bi-temporal change detection
Compare two passes over the same area and quantify exactly what appeared, vanished or shifted between them.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### 🗺️ Land cover classification
Segment vegetation, water, built-up and barren classes against the CORINE taxonomy, with per-class area breakdowns.

</td>
<td width="33%" valign="top">

### 📏 Measurement
Distance, area and perimeter, drawn straight onto the imagery with sub-meter geodesic precision.

</td>
<td width="33%" valign="top">

### 🛰️ Map workspace
Pan a live satellite basemap, draw an area of interest with rectangle / polygon / circle / freehand tools, and query only what's selected.

</td>
</tr>
</table>

Everything above lives behind one consistent workspace shell:

| Section | Pages |
|---|---|
| **Workspace** | Overview dashboard · Map Explore · Conversational Query |
| **Analysis** | Object Detection · Change Detection · Land Cover · Measurements |
| **Library** | Projects · Reports |

<details>
<summary><strong>What's real vs. what's mocked, honestly</strong></summary>
<br>

The frontend, API surface, database schema and evaluation harness are fully built and wired end-to-end. The inference layer behind `/api/v1/query` currently runs a deterministic regex + heuristics engine rather than a trained model — it exists so the entire pipeline (intent → tool selection → structured result → formatted response) can be demoed and load-tested before a real vision-language model is dropped in behind the exact same interface. The `BigEarthNet` and `VRSBench` evaluation endpoints are wired against the actual published benchmark task structure, ready to score a real model once one is attached.

</details>

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0D1220,50:3D7FFF,100:0D1220" width="100%" alt="" />

## Design system

The whole app runs on a **monochrome-blue / brushed-metal** language rather than the flat dark-mode-with-accent-color look most dashboards default to:

- **Chrome & bevel** — every interactive surface (nav items, buttons, panels) reads as a physical hardware key: raised at rest, pressed-in when active, with real inset highlight/shadow, not a flat colour swap.
- **One accent, used sparingly** — a single blue carries every "this matters" signal; everything else is graphite, chrome and near-black so the accent never has to compete.
- **HUD instrumentation** — live telemetry tickers, scan-line sweeps, a CRT-style satellite readout panel and a boot sequence give the workspace the feel of mission control, not a generic admin template.
- **Typeface** — Maxima Nouva throughout the UI; Zrnic reserved exclusively for the wordmark.

<div align="center">

| ![](https://img.shields.io/badge/%20-0D1220?style=flat-square) | ![](https://img.shields.io/badge/%20-212C44?style=flat-square) | ![](https://img.shields.io/badge/%20-354460?style=flat-square) | ![](https://img.shields.io/badge/%20-3D7FFF?style=flat-square) | ![](https://img.shields.io/badge/%20-6FB8FF?style=flat-square) | ![](https://img.shields.io/badge/%20-F2F2F4?style=flat-square) |
|:---:|:---:|:---:|:---:|:---:|:---:|
| `#0D1220`<br>seam | `#212C44`<br>chrome low | `#354460`<br>chrome mid | `#3D7FFF`<br>**accent** | `#6FB8FF`<br>atmos | `#F2F2F4`<br>text |

</div>

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0D1220,50:3D7FFF,100:0D1220" width="100%" alt="" />

## Architecture

```mermaid
flowchart LR
    subgraph FE["Frontend — Vite + React 19"]
        Pages["Pages & Components"]
        Store["Zustand store"]
        Map["MapLibre GL"]
        Pages --> Store
        Pages --> Map
    end

    subgraph BE["Backend — FastAPI"]
        API["/api/v1 REST routes"]
        Engine["VLM inference engine"]
        GIS["GIS processor"]
        DB[("PostgreSQL")]
        API --> Engine
        API --> GIS
        API --> DB
    end

    Pages -- "fetch /api/v1/*" --> API
```

<details>
<summary><strong>Request lifecycle for a single query</strong></summary>

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant E as Inference Engine
    U->>F: "Detect ships near Mumbai port"
    F->>A: POST /api/v1/query
    A->>E: parse intent + run tool
    E-->>A: structured result
    A-->>F: JSON response
    F-->>U: map overlay + summary
```

</details>

Deployed as a single **Vercel** project using [Services](https://vercel.com/docs/services): the Vite frontend and the FastAPI backend build and ship independently but serve from one domain — `/api/*` routes to the backend, everything else to the frontend.

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0D1220,50:3D7FFF,100:0D1220" width="100%" alt="" />

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React 19 · TypeScript 6 |
| Bundler | Vite 8 |
| Styling | Tailwind CSS 4 |
| State | Zustand |
| Routing | React Router 7 |
| Maps | MapLibre GL JS |
| 3D | React Three Fiber (landing page Earth) |
| Motion | Motion (Framer Motion) |
| Charts | Recharts |
| Backend | FastAPI · SQLAlchemy · PostgreSQL |
| Auth | python-jose (JWT) |
| Testing | Pytest |

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0D1220,50:3D7FFF,100:0D1220" width="100%" alt="" />

## Getting started

### Frontend

```bash
npm install
npm run dev        # http://localhost:5173
```

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
<img src="https://capsule-render.vercel.app/api?type=waving&height=120&color=0:3D7FFF,50:354460,100:0D1220&section=footer" width="100%" alt="" />

*SatQuery AI — making satellite intelligence accessible through conversation.*

</div>
