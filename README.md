<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&height=210&color=0:0D1220,50:354460,100:3D7FFF&text=SatQuery%20AI&fontColor=F2F2F4&fontSize=62&fontAlignY=38&animation=fadeIn&section=header" width="100%" alt="SatQuery AI" />

<img src="public/brand/satquery-icon-512.png" width="120" alt="SatQuery AI logo" />

<br />

[![Typing SVG](https://readme-typing-svg.demolab.com/?font=Orbitron&weight=700&size=20&duration=2800&pause=900&color=3D7FFF&center=true&vCenter=true&width=760&height=50&lines=Ask+Earth+Anything.;Draw+an+area.+Query+only+that.;Detection+%C2%B7+Change+%C2%B7+Land+cover+%C2%B7+Measurement.;SIH+2026+-+Problem+Statement+SIH26167.)](https://github.com/Vaibhav-Reddy560/SatQuery-AI)

```
ORBITAL LINK ......... OK
SENSOR ARRAY .......... OK
VISION MODEL ........... READY
4 CAPABILITIES ONLINE
```

[![CI](https://github.com/Vaibhav-Reddy560/SatQuery-AI/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/Vaibhav-Reddy560/SatQuery-AI/actions/workflows/backend-ci.yml)
![React](https://img.shields.io/badge/React-19-3D7FFF?style=for-the-badge&logo=react&logoColor=white&labelColor=0D1220)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3D7FFF?style=for-the-badge&logo=typescript&logoColor=white&labelColor=0D1220)
![Vite](https://img.shields.io/badge/Vite-8-3D7FFF?style=for-the-badge&logo=vite&logoColor=white&labelColor=0D1220)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-3D7FFF?style=for-the-badge&logo=tailwindcss&logoColor=white&labelColor=0D1220)
![MapLibre](https://img.shields.io/badge/MapLibre_GL-6-6FB8FF?style=for-the-badge&logo=maplibre&logoColor=white&labelColor=0D1220)
![FastAPI](https://img.shields.io/badge/FastAPI-backend-6FB8FF?style=for-the-badge&logo=fastapi&logoColor=white&labelColor=0D1220)
![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-3D7FFF?style=for-the-badge&logo=vercel&logoColor=white&labelColor=0D1220)

</div>

<br />

## Overview

**SatQuery AI** is a conversational satellite-intelligence workspace — ask a question in plain English, draw an area of interest on the map, and get object detection, change detection, land-cover classification and measurements back as structured, explainable results.

Built for **Smart India Hackathon 2026** (Problem Statement **SIH26167**), it pairs a full interactive mapping dashboard with a FastAPI backend structured around real remote-sensing benchmarks (**BigEarthNet**, **VRSBench**), ready for a trained vision-language model to be dropped in behind the same API surface.

<div align="center">

**[Report a bug](../../issues)** &nbsp;·&nbsp; **[Request a feature](../../issues)**

</div>

---

### Contents

[Features](#features) · [Design system](#design-system) · [Architecture](#architecture) · [Tech stack](#tech-stack) · [Getting started](#getting-started) · [Deployment](#deployment) · [Roadmap](#roadmap) · [Team](#team)

---

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

---

## Design system

The whole app runs on a **monochrome-blue / brushed-metal** language rather than the flat dark-mode-with-accent-color look most dashboards default to:

- **Chrome & bevel** — every interactive surface (nav items, buttons, panels) reads as a physical hardware key: raised at rest, pressed-in when active, with real inset highlight/shadow, not a flat colour swap.
- **One accent, used sparingly** — a single blue (`#3D7FFF`) carries every "this matters" signal; everything else is graphite, chrome and near-black so the accent never has to compete.
- **HUD instrumentation** — live telemetry tickers, scan-line sweeps, a CRT-style satellite readout panel and a boot sequence give the workspace the feel of mission control, not a generic admin template.
- **Typeface** — Maxima Nouva throughout the UI; Zrnic reserved exclusively for the wordmark.

---

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

Deployed as a single **Vercel** project using [Services](https://vercel.com/docs/services): the Vite frontend and the FastAPI backend build and ship independently but serve from one domain — `/api/*` routes to the backend, everything else to the frontend.

---

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

---

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

---

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

---

## Roadmap

- [ ] Swap the mock inference engine for a trained vision-language model behind the existing `/api/v1/query` contract
- [ ] Real Sentinel-1/Sentinel-2 tile ingestion in place of reference imagery
- [ ] Authenticated multi-user projects with persisted history
- [ ] Async job queue for long-running analyses

---

## Team

Built for **Smart India Hackathon 2026** by:

| | |
|---|---|
| [**Vaibhav-Reddy560**](https://github.com/Vaibhav-Reddy560) | Frontend & design system |
| [**Lochanchennur**](https://github.com/Lochanchennur) | Backend & MLOps |
| [**CalmOutlaws**](https://github.com/CalmOutlaws) | Backend & MLOps |

<br />

<div align="center">
<img src="https://capsule-render.vercel.app/api?type=waving&height=120&color=0:3D7FFF,50:354460,100:0D1220&section=footer" width="100%" alt="" />

*SatQuery AI — making satellite intelligence accessible through conversation.*

</div>
