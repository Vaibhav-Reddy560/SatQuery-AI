import type { QueryResponse, QueryIntent, AnalysisOutput } from "@/types/query";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

export async function sendQueryToBackend(
  queryId: string,
  queryText: string,
  centre: [number, number],
  locationName: string
): Promise<QueryResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/query/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: queryText,
        centre: centre,
        location_name: locationName,
        satellite_sources: ["Sentinel-1 SAR", "Sentinel-2 Multispectral"],
      }),
    });

    if (!res.ok) {
      console.warn(`Backend API returned HTTP status ${res.status}, falling back to local engine.`);
      return null;
    }

    const data = await res.json();
    
    const intent: QueryIntent = {
      type: (data.intent.type as any) || "general_question",
      location: data.intent.location,
      centre: data.intent.centre || centre,
      confidence: data.intent.confidence || 0.94,
    };

    const analysisResult: AnalysisOutput = {
      toolId: "object_detector",
      queryId: queryId,
      confidence: data.confidence || 0.94,
      location: locationName,
      centre: centre,
      ...(data.analysis_payload as any),
    };

    return {
      queryId: queryId,
      intent: intent,
      result: analysisResult,
      responseText: data.text_response,
      attachments: (data.attachments || []).map((att: any) => ({
        type: att.type === "map_overlay" ? "map_region" : (att.type || "data"),
        label: att.label,
        confidence: att.confidence,
      })),
      suggestedActions: data.suggested_actions || [],
      processingTimeMs: data.latency_ms || 350,
    };
  } catch (error) {
    console.warn("Backend FastAPI server not reached. Operating in client-side mode.", error);
    return null;
  }
}

export async function fetchBackendModelStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/models/status`);
    if (res.ok) return await res.json();
  } catch {
    return null;
  }
}

export async function fetchBigEarthNetSamples() {
  try {
    const res = await fetch(`${API_BASE_URL}/datasets/bigearthnet/samples`);
    if (res.ok) return await res.json();
  } catch {
    return null;
  }
}
