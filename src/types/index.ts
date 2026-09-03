// ── Domain Types ──────────────────────────────────────────

export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface SatelliteImage {
  id: string;
  name: string;
  location: string;
  coordinates: GeoCoordinates;
  capturedAt: string;
  resolution: string;
  source: string;
  thumbnailUrl?: string;
  tags: string[];
}

// ── Dashboard Stats ───────────────────────────────────────

export interface DashboardStats {
  totalImagesAnalyzed: number;
  areasAnalyzed: number;
  objectsDetected: number;
  changesDetected: number;
}

export interface RecentActivity {
  id: string;
  type: "analysis" | "detection" | "change" | "query" | "project";
  title: string;
  description: string;
  timestamp: string;
  status: AnalysisStatus;
}

// ── Object Detection ──────────────────────────────────────

export interface DetectedObject {
  id: string;
  category: string;
  label: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ObjectDetectionResult {
  id: string;
  imageId: string;
  imageName: string;
  detectedObjects: DetectedObject[];
  totalObjects: number;
  categories: ObjectCategory[];
  processedAt: string;
}

export interface ObjectCategory {
  name: string;
  count: number;
  avgConfidence: number;
  color: string;
}

// ── Change Detection ──────────────────────────────────────

export interface ChangeDetectionResult {
  id: string;
  beforeImageId: string;
  afterImageId: string;
  beforeDate: string;
  afterDate: string;
  location: string;
  changes: DetectedChange[];
  statistics: ChangeStatistics;
  status: AnalysisStatus;
}

export interface DetectedChange {
  id: string;
  type: "new_construction" | "demolition" | "vegetation_change" | "water_change" | "land_use_change";
  description: string;
  area: number;
  confidence: number;
}

export interface ChangeStatistics {
  totalAreaChanged: number;
  newConstruction: number;
  demolished: number;
  vegetationLoss: number;
  vegetationGain: number;
}

// ── Land Cover ────────────────────────────────────────────

export interface LandCoverClassification {
  id: string;
  name: string;
  percentage: number;
  area: number;
  color: string;
}

export interface LandCoverResult {
  id: string;
  location: string;
  imageId: string;
  classifications: LandCoverClassification[];
  analyzedAt: string;
}

// ── Measurements ──────────────────────────────────────────

export type MeasurementType = "distance" | "area" | "perimeter";

export interface Measurement {
  id: string;
  type: MeasurementType;
  value: number;
  unit: string;
  label: string;
  coordinates: GeoCoordinates[];
  createdAt: string;
}

// ── Projects ──────────────────────────────────────────────

export type ProjectStatus = "active" | "archived" | "draft";

export interface Project {
  id: string;
  name: string;
  location: string;
  description: string;
  analysisCount: number;
  imageCount: number;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

// ── Reports ───────────────────────────────────────────────

export type ReportStatus = "draft" | "generated" | "exported";

export interface Report {
  id: string;
  title: string;
  projectName: string;
  summary: string;
  pageCount: number;
  status: ReportStatus;
  createdAt: string;
  generatedAt?: string;
}

// ── Query / Chat ──────────────────────────────────────────

export type MessageRole = "user" | "assistant";

export interface QueryMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  attachments?: QueryAttachment[];
  suggestedActions?: string[];
}

export interface QueryAttachment {
  type: "image" | "map_region" | "data";
  label: string;
  imageUrl?: string;
  confidence?: number;
}
