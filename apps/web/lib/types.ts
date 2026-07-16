// Client-side mirror of the AnswerEnvelope contract (see packages/core/src/types.ts).
export type Role = 'constable' | 'investigator' | 'supervisor' | 'policymaker';

export interface MapPoint { lat: number; lng: number; weight?: number; label?: string; fir_id?: string; kind?: string; }
export interface RiskZone { lat: number; lng: number; radius_km: number; intensity: number; window?: string; }
export interface MapAnswer { kind: 'map'; points: MapPoint[]; riskZones?: RiskZone[]; center?: { lat: number; lng: number; zoom?: number }; _grid?: { lat: number; lng: number; intensity: number }[]; }

export interface GraphNode { id: string; label: string; group?: number; centrality?: number; kind: string; flags?: string[]; }
export interface GraphEdge { source: string; target: string; type: string; weight?: number; predicted?: boolean; score?: number; flagged?: boolean; }
export interface GraphAnswer { kind: 'graph'; nodes: GraphNode[]; edges: GraphEdge[]; communities?: Record<string, number>; }

export interface ChartSeries { name: string; points: { x: string | number; y: number }[]; }
export interface ChartAnswer { kind: 'chart'; chartType: 'line' | 'bar' | 'area' | 'scatter'; series: ChartSeries[]; xLabel?: string; yLabel?: string; }

export interface TableAnswer { kind: 'table'; columns: { key: string; label: string }[]; rows: Record<string, any>[]; }
export interface CardAnswer { kind: 'card'; title: string; fields: { label: string; value: string }[]; }
export interface TextAnswer { kind: 'text'; }

export type AnswerSurface = MapAnswer | GraphAnswer | ChartAnswer | TableAnswer | CardAnswer | TextAnswer;

export interface ReasoningStep { step: string; detail: string; refs?: string[]; }
export interface Evidence { fir_ids: string[]; query: string; confidence: number; reasoning_path: ReasoningStep[]; }

/** Non-PII hydration of the evidence FIRs — drives the timeline, map overlay and inspector. */
export interface FirRecord {
  id: string;
  crime_type: string;
  district: string;
  ps_code: string;
  occurred_at: string;
  status: string;
  lat: number;
  lng: number;
  mo_tags: string[];
  value_loss: number;
}

export interface AnswerEnvelope {
  intent: string;
  narration_en: string;
  narration_kn?: string;
  surface: AnswerSurface;
  evidence: Evidence;
  followups: string[];
  context?: { records: FirRecord[] };
}

/** What the analyst currently has selected — the spine every coordinated view subscribes to. */
export type SelectionKind = 'fir' | 'person' | null;
export interface Selection { kind: SelectionKind; id: string | null; }
/** Inclusive epoch-ms window from the timeline brush; null = no temporal filter. */
export type TimeWindow = { from: number; to: number } | null;
