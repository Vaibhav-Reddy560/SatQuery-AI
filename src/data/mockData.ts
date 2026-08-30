// ── Mock Data for SatQuery ────────────────────────────────
// This file contains realistic mock data for all features.
// When real APIs are connected, replace these with actual data.

import type {
  DashboardStats,
  RecentActivity,
  SatelliteImage,
  ObjectDetectionResult,
  ChangeDetectionResult,
  LandCoverResult,
  Measurement,
  Project,
  Report,
  QueryMessage,
  MapLayer,
} from "@/types";

// ── Dashboard ─────────────────────────────────────────────

export const dashboardStats: DashboardStats = {
  totalImagesAnalyzed: 12847,
  areasAnalyzed: 3240,
  objectsDetected: 89412,
  changesDetected: 1563,
};

export const recentActivities: RecentActivity[] = [
  {
    id: "act-1",
    type: "analysis",
    title: "Urban Expansion Analysis",
    description: "Detected 14.2 km² of new construction in Greater Mumbai region",
    timestamp: "2026-08-30T09:15:00Z",
    status: "completed",
  },
  {
    id: "act-2",
    type: "detection",
    title: "Object Detection — Bangalore",
    description: "Identified 2,847 buildings and 312 vehicles across 12 images",
    timestamp: "2026-08-30T08:42:00Z",
    status: "completed",
  },
  {
    id: "act-3",
    type: "change",
    title: "Flood Monitoring — Kerala",
    description: "Compared Jan 2026 vs Aug 2026 imagery, 8.7 km² water extent change",
    timestamp: "2026-08-29T16:30:00Z",
    status: "completed",
  },
  {
    id: "act-4",
    type: "query",
    title: "Query: Deforestation near Sundarbans",
    description: "Natural language query returned 3 change detection results",
    timestamp: "2026-08-29T14:05:00Z",
    status: "completed",
  },
  {
    id: "act-5",
    type: "analysis",
    title: "Agricultural Land Classification",
    description: "Land cover analysis completed for Punjab wheat belt — 5,200 km²",
    timestamp: "2026-08-29T11:20:00Z",
    status: "completed",
  },
  {
    id: "act-6",
    type: "project",
    title: "Coastal Erosion Study — Odisha",
    description: "New project created with 48 Sentinel-2 images from 2024–2026",
    timestamp: "2026-08-28T09:00:00Z",
    status: "completed",
  },
  {
    id: "act-7",
    type: "detection",
    title: "Solar Panel Detection — Rajasthan",
    description: "Found 1,203 solar installations across 8 images",
    timestamp: "2026-08-28T07:30:00Z",
    status: "processing",
  },
];

// ── Satellite Images ──────────────────────────────────────

export const satelliteImages: SatelliteImage[] = [
  {
    id: "img-1",
    name: "Mumbai Urban Composite",
    location: "Mumbai, Maharashtra, India",
    coordinates: { lat: 19.076, lng: 72.8777 },
    capturedAt: "2026-08-15",
    resolution: "0.5m",
    source: "WorldView-3",
    tags: ["urban", "infrastructure"],
  },
  {
    id: "img-2",
    name: "Delhi NCR Multi-Spectral",
    location: "New Delhi, India",
    coordinates: { lat: 28.6139, lng: 77.209 },
    capturedAt: "2026-08-12",
    resolution: "1.0m",
    source: "Sentinel-2",
    tags: ["urban", "vegetation"],
  },
  {
    id: "img-3",
    name: "Sundarbans Coastal",
    location: "Sundarbans, West Bengal",
    coordinates: { lat: 21.9497, lng: 89.1833 },
    capturedAt: "2026-08-10",
    resolution: "3.0m",
    source: "Landsat-9",
    tags: ["coastal", "ecology"],
  },
  {
    id: "img-4",
    name: "Punjab Agricultural Belt",
    location: "Ludhiana, Punjab",
    coordinates: { lat: 30.901, lng: 75.8573 },
    capturedAt: "2026-08-08",
    resolution: "10m",
    source: "Sentinel-2",
    tags: ["agriculture", "rural"],
  },
  {
    id: "img-5",
    name: "Bangalore Tech Corridor",
    location: "Bengaluru, Karnataka",
    coordinates: { lat: 12.9716, lng: 77.5946 },
    capturedAt: "2026-08-05",
    resolution: "0.3m",
    source: "Pléiades Neo",
    tags: ["urban", "commercial"],
  },
  {
    id: "img-6",
    name: "Kerala Backwaters",
    location: "Alleppey, Kerala",
    coordinates: { lat: 9.4981, lng: 76.3388 },
    capturedAt: "2026-08-01",
    resolution: "2.0m",
    source: "WorldView-2",
    tags: ["water", "ecology"],
  },
];

// ── Object Detection ──────────────────────────────────────

export const objectDetectionResult: ObjectDetectionResult = {
  id: "od-1",
  imageId: "img-5",
  imageName: "Bangalore Tech Corridor",
  detectedObjects: [
    { id: "obj-1", category: "Building", label: "Commercial Complex", confidence: 0.97, boundingBox: { x: 120, y: 80, width: 200, height: 150 } },
    { id: "obj-2", category: "Building", label: "Office Tower", confidence: 0.94, boundingBox: { x: 350, y: 60, width: 160, height: 220 } },
    { id: "obj-3", category: "Vehicle", label: "Parking Lot Vehicles", confidence: 0.91, boundingBox: { x: 80, y: 260, width: 180, height: 60 } },
    { id: "obj-4", category: "Road", label: "Highway Segment", confidence: 0.96, boundingBox: { x: 0, y: 200, width: 500, height: 40 } },
    { id: "obj-5", category: "Vegetation", label: "Tree Cluster", confidence: 0.89, boundingBox: { x: 400, y: 300, width: 120, height: 100 } },
    { id: "obj-6", category: "Building", label: "Residential Block", confidence: 0.92, boundingBox: { x: 50, y: 350, width: 140, height: 80 } },
    { id: "obj-7", category: "Water Body", label: "Storm Water Drain", confidence: 0.87, boundingBox: { x: 260, y: 320, width: 100, height: 20 } },
    { id: "obj-8", category: "Solar Panel", label: "Rooftop Solar Array", confidence: 0.93, boundingBox: { x: 150, y: 90, width: 60, height: 40 } },
  ],
  totalObjects: 8,
  categories: [
    { name: "Building", count: 3, avgConfidence: 0.943, color: "#3b82f6" },
    { name: "Vehicle", count: 1, avgConfidence: 0.91, color: "#f59e0b" },
    { name: "Road", count: 1, avgConfidence: 0.96, color: "#6b7280" },
    { name: "Vegetation", count: 1, avgConfidence: 0.89, color: "#22c55e" },
    { name: "Water Body", count: 1, avgConfidence: 0.87, color: "#06b6d4" },
    { name: "Solar Panel", count: 1, avgConfidence: 0.93, color: "#a855f7" },
  ],
  processedAt: "2026-08-30T08:42:00Z",
};

// ── Change Detection ──────────────────────────────────────

export const changeDetectionResult: ChangeDetectionResult = {
  id: "cd-1",
  beforeImageId: "img-1",
  afterImageId: "img-2",
  beforeDate: "2024-03-15",
  afterDate: "2026-08-12",
  location: "Navi Mumbai, Maharashtra",
  changes: [
    {
      id: "ch-1",
      type: "new_construction",
      description: "New residential complex (42 towers) along Palm Beach Road",
      area: 2.8,
      confidence: 0.96,
    },
    {
      id: "ch-2",
      type: "vegetation_change",
      description: "Mangrove buffer zone reduced by approximately 1.2 km²",
      area: 1.2,
      confidence: 0.89,
    },
    {
      id: "ch-3",
      type: "new_construction",
      description: "Commercial IT park expansion near Airoli",
      area: 3.5,
      confidence: 0.94,
    },
    {
      id: "ch-4",
      type: "water_change",
      description: "Coastal silting observed in Thane Creek area",
      area: 0.8,
      confidence: 0.82,
    },
    {
      id: "ch-5",
      type: "land_use_change",
      description: "Agricultural land converted to industrial zone",
      area: 5.1,
      confidence: 0.91,
    },
  ],
  statistics: {
    totalAreaChanged: 14.2,
    newConstruction: 6.3,
    demolished: 0.4,
    vegetationLoss: 1.8,
    vegetationGain: 0.2,
  },
  status: "completed",
};

// ── Land Cover ────────────────────────────────────────────

export const landCoverResult: LandCoverResult = {
  id: "lc-1",
  location: "Punjab Wheat Belt — Ludhiana District",
  imageId: "img-4",
  classifications: [
    { id: "lc-c1", name: "Cropland", percentage: 62.4, area: 3244, color: "#22c55e" },
    { id: "lc-c2", name: "Built-up Area", percentage: 14.8, area: 770, color: "#3b82f6" },
    { id: "lc-c3", name: "Water Bodies", percentage: 4.2, area: 218, color: "#06b6d4" },
    { id: "lc-c4", name: "Bare Soil", percentage: 8.1, area: 421, color: "#d97706" },
    { id: "lc-c5", name: "Tree Cover", percentage: 6.3, area: 328, color: "#15803d" },
    { id: "lc-c6", name: "Grassland", percentage: 3.0, area: 156, color: "#84cc16" },
    { id: "lc-c7", name: "Shrubland", percentage: 1.2, area: 62, color: "#a16207" },
  ],
  analyzedAt: "2026-08-29T11:20:00Z",
};

// ── Measurements ──────────────────────────────────────────

export const measurements: Measurement[] = [
  {
    id: "meas-1",
    type: "distance",
    value: 12.4,
    unit: "km",
    label: "Coastline segment — Odisha",
    coordinates: [{ lat: 19.76, lng: 85.83 }, { lat: 19.82, lng: 85.98 }],
    createdAt: "2026-08-30T07:00:00Z",
  },
  {
    id: "meas-2",
    type: "area",
    value: 8.7,
    unit: "km²",
    label: "Flood extent — Kerala",
    coordinates: [{ lat: 9.5, lng: 76.3 }, { lat: 9.5, lng: 76.4 }, { lat: 9.45, lng: 76.4 }, { lat: 9.45, lng: 76.3 }],
    createdAt: "2026-08-29T16:45:00Z",
  },
  {
    id: "meas-3",
    type: "perimeter",
    value: 28.6,
    unit: "km",
    label: "Lake boundary — Rajasthan",
    coordinates: [{ lat: 26.9, lng: 75.8 }, { lat: 26.92, lng: 75.82 }],
    createdAt: "2026-08-28T14:10:00Z",
  },
  {
    id: "meas-4",
    type: "distance",
    value: 3.2,
    unit: "km",
    label: "River width — Ganges",
    coordinates: [{ lat: 25.43, lng: 83.01 }, { lat: 25.44, lng: 83.04 }],
    createdAt: "2026-08-27T10:30:00Z",
  },
  {
    id: "meas-5",
    type: "area",
    value: 52.1,
    unit: "km²",
    label: "Deforestation zone — Assam",
    coordinates: [{ lat: 26.5, lng: 92.8 }, { lat: 26.5, lng: 93.0 }, { lat: 26.4, lng: 93.0 }, { lat: 26.4, lng: 92.8 }],
    createdAt: "2026-08-26T09:00:00Z",
  },
];

// ── Projects ──────────────────────────────────────────────

export const projects: Project[] = [
  {
    id: "proj-1",
    name: "Navi Mumbai Urban Growth",
    location: "Navi Mumbai, Maharashtra",
    description: "Tracking urban expansion and mangrove conservation along the coastline.",
    analysisCount: 34,
    imageCount: 128,
    status: "active",
    createdAt: "2026-06-10T00:00:00Z",
    updatedAt: "2026-08-30T09:15:00Z",
  },
  {
    id: "proj-2",
    name: "Sundarbans Ecosystem Watch",
    location: "Sundarbans, West Bengal",
    description: "Monitoring mangrove health and coastal erosion in the Sundarbans delta.",
    analysisCount: 22,
    imageCount: 86,
    status: "active",
    createdAt: "2026-05-20T00:00:00Z",
    updatedAt: "2026-08-29T14:05:00Z",
  },
  {
    id: "proj-3",
    name: "Kerala Flood Assessment",
    location: "Alleppey, Kerala",
    description: "Post-monsoon flood extent mapping and damage assessment.",
    analysisCount: 18,
    imageCount: 64,
    status: "active",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-08-29T16:30:00Z",
  },
  {
    id: "proj-4",
    name: "Punjab Crop Health Survey",
    location: "Ludhiana, Punjab",
    description: "Seasonal crop health and land-use classification for the wheat belt.",
    analysisCount: 42,
    imageCount: 210,
    status: "active",
    createdAt: "2026-03-15T00:00:00Z",
    updatedAt: "2026-08-29T11:20:00Z",
  },
  {
    id: "proj-5",
    name: "Odisha Coastal Erosion Study",
    location: "Puri, Odisha",
    description: "Multi-year coastal erosion analysis along the Bay of Bengal shoreline.",
    analysisCount: 12,
    imageCount: 48,
    status: "active",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-28T09:00:00Z",
  },
  {
    id: "proj-6",
    name: "Delhi Air Quality Mapping",
    location: "New Delhi, India",
    description: "Correlating satellite thermal data with ground-level air quality metrics.",
    analysisCount: 8,
    imageCount: 32,
    status: "archived",
    createdAt: "2025-11-01T00:00:00Z",
    updatedAt: "2026-02-15T00:00:00Z",
  },
];

// ── Reports ───────────────────────────────────────────────

export const reports: Report[] = [
  {
    id: "rep-1",
    title: "Navi Mumbai Urban Expansion — Q3 2026",
    projectName: "Navi Mumbai Urban Growth",
    summary: "Comprehensive analysis of urban expansion patterns in Navi Mumbai from June to August 2026, highlighting 14.2 km² of new construction.",
    pageCount: 24,
    status: "generated",
    createdAt: "2026-08-30T09:20:00Z",
    generatedAt: "2026-08-30T09:25:00Z",
  },
  {
    id: "rep-2",
    title: "Sundarbans Mangrove Health — Annual 2026",
    projectName: "Sundarbans Ecosystem Watch",
    summary: "Yearly assessment of mangrove cover change, water quality indicators, and biodiversity corridor status.",
    pageCount: 48,
    status: "generated",
    createdAt: "2026-08-15T00:00:00Z",
    generatedAt: "2026-08-16T14:00:00Z",
  },
  {
    id: "rep-3",
    title: "Kerala Flood Extent Report — August 2026",
    projectName: "Kerala Flood Assessment",
    summary: "Rapid damage assessment and flood extent mapping for the Alleppey district during the 2026 monsoon season.",
    pageCount: 16,
    status: "draft",
    createdAt: "2026-08-29T17:00:00Z",
  },
  {
    id: "rep-4",
    title: "Punjab Wheat Yield Estimate — Kharif 2026",
    projectName: "Punjab Crop Health Survey",
    summary: "NDVI-based crop health assessment and projected wheat yield estimates for Ludhiana district.",
    pageCount: 32,
    status: "exported",
    createdAt: "2026-08-10T00:00:00Z",
    generatedAt: "2026-08-11T10:00:00Z",
  },
];

// ── Query / Chat Messages ─────────────────────────────────

export const queryMessages: QueryMessage[] = [
  {
    id: "msg-1",
    role: "user",
    content: "Identify all water bodies in the Sundarbans region from the latest satellite pass.",
    timestamp: "2026-08-30T08:00:00Z",
  },
  {
    id: "msg-2",
    role: "assistant",
    content:
      "Based on the Sentinel-2 image from August 28, 2026, I identified **14 water bodies** in the Sundarbans region, covering approximately **42.3 km²**. The major water bodies include:\n\n• **Matla River** — 18.7 km² surface area\n• **Bidyadhari River** — 12.1 km² surface area\n• **Thirteen distributary channels** — combined 11.5 km²\n\nWater turbidity is elevated in 3 channels, likely due to recent monsoon runoff. Confidence: **94%**",
    timestamp: "2026-08-30T08:01:30Z",
    attachments: [
      {
        type: "image",
        label: "Water body detection overlay",
        confidence: 0.94,
      },
    ],
    suggestedActions: ["Show on map", "Export detection data", "Compare with last month"],
  },
  {
    id: "msg-3",
    role: "user",
    content: "What changed in this area since January 2025?",
    timestamp: "2026-08-30T08:03:00Z",
  },
  {
    id: "msg-4",
    role: "assistant",
    content:
      "Comparing January 2025 to August 2026 imagery for the Sundarbans region:\n\n• **Mangrove loss**: 2.4 km² (primarily along the western edge)\n• **Sediment deposition**: 1.8 km² of new land formation in the eastern channels\n• **Water channel migration**: 3 channels shifted course by 200–400m\n• **New aquaculture ponds**: 0.6 km² of cleared mangrove area now showing regular grid patterns\n\nNet change: **1.0 km² reduction** in total mangrove cover over 19 months.",
    timestamp: "2026-08-30T08:04:15Z",
    attachments: [
      {
        type: "map_region",
        label: "Change detection overlay",
        confidence: 0.91,
      },
    ],
    suggestedActions: ["Show changes on map", "Generate change report", "Zoom to losses"],
  },
];

// ── Map Layers ────────────────────────────────────────────

export const defaultMapLayers: MapLayer[] = [
  { id: "layer-sat", name: "Satellite Imagery", visible: true, type: "satellite" },
  { id: "layer-terrain", name: "Terrain", visible: false, type: "terrain" },
  { id: "layer-labels", name: "Place Labels", visible: true, type: "labels" },
  { id: "layer-boundaries", name: "Administrative Boundaries", visible: false, type: "boundaries" },
];

// ── Activity Timeline Data (for charts) ───────────────────

export const weeklyActivityData = [
  { day: "Mon", images: 142, analyses: 28, detections: 1240 },
  { day: "Tue", images: 198, analyses: 35, detections: 1680 },
  { day: "Wed", images: 165, analyses: 31, detections: 1420 },
  { day: "Thu", images: 220, analyses: 42, detections: 2100 },
  { day: "Fri", images: 185, analyses: 38, detections: 1890 },
  { day: "Sat", images: 90, analyses: 18, detections: 780 },
  { day: "Sun", images: 65, analyses: 12, detections: 520 },
];

export const monthlyTrendData = [
  { month: "Mar", objects: 12400, changes: 180, images: 1800 },
  { month: "Apr", objects: 14200, changes: 220, images: 2100 },
  { month: "May", objects: 15800, changes: 260, images: 2400 },
  { month: "Jun", objects: 11200, changes: 190, images: 1600 },
  { month: "Jul", objects: 13600, changes: 210, images: 1900 },
  { month: "Aug", objects: 16400, changes: 280, images: 2600 },
];
