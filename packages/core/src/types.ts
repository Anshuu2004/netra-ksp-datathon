// NETRA canonical domain types. Mirrors the synthetic dataset schema
// (data/generator) and the AnswerEnvelope contract from docs/ARCHITECTURE.md.

// ---------- Roles & governance ----------
export type Role = 'constable' | 'investigator' | 'supervisor' | 'policymaker';

export type Language = 'en' | 'kn';

// ---------- Core entities ----------
export interface District {
  name: string;
  code: string;
  lat: number;
  lng: number;
  population: number;
  urbanization_index: number; // 0-1
  literacy_rate: number; // %
  unemployment_proxy: number; // 0-1
}

export interface Station {
  ps_code: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
}

export type Gender = 'M' | 'F';

export interface Person {
  id: string;
  full_name: string;
  full_name_kn: string;
  gender: Gender;
  age: number;
  occupation: string;
  district: string;
  ps_code: string;
  socio_economic_band: string;
  is_repeat_offender: boolean;
  risk_score: number; // 0-100
  mo_fingerprint: string[];
}

export type FirStatus = 'registered' | 'under_investigation' | 'chargesheeted' | 'closed';

export interface Fir {
  id: string;
  title: string;
  crime_type: string;
  ipc_bns_sections: string[];
  occurred_at: string; // ISO
  reported_at: string; // ISO
  district: string;
  ps_code: string;
  lat: number;
  lng: number;
  status: FirStatus;
  mo_tags: string[];
  narrative_en: string;
  narrative_kn: string | null;
  value_loss: number;
}

export type AccusedRole = 'accused' | 'suspect';
export type ArrestStatus = 'arrested' | 'absconding' | 'bailed';

export interface FirAccused {
  fir_id: string;
  person_id: string;
  role: AccusedRole;
  arrest_status: ArrestStatus;
}

export interface FirVictim {
  fir_id: string;
  person_id: string;
  injury: 'none' | 'minor' | 'grievous';
  loss_amount: number;
}

export type AssociationType =
  | 'cooffender' | 'family' | 'associate' | 'phone' | 'vehicle' | 'financial' | 'covictim';

export interface Association {
  person_a: string;
  person_b: string;
  type: AssociationType;
  weight: number;
  source_fir_ids: string[];
}

export interface Account {
  id: string;
  holder_person_id: string;
  bank: string;
  account_no_masked: string;
  kyc_band: 'full' | 'minimal' | 'unverified';
}

export interface Transaction {
  id: string;
  from_account: string;
  to_account: string;
  amount: number;
  ts: string; // ISO
  channel: string;
  flagged_reason: string | null;
}

export interface AuditEntry {
  id: string;
  ts: string;
  user_id: string;
  role: Role;
  action: string;
  intent: string;
  entity_refs: string[];
  pii_revealed: boolean;
}

export interface Dataset {
  districts: District[];
  stations: Station[];
  persons: Person[];
  firs: Fir[];
  fir_accused: FirAccused[];
  fir_victim: FirVictim[];
  associations: Association[];
  accounts: Account[];
  transactions: Transaction[];
}

// ---------- Intents ----------
export type IntentName =
  | 'retrieve_fir' | 'search_firs' | 'person_profile' | 'criminal_history'
  | 'hotspot_map' | 'trend_analysis' | 'seasonal_pattern'
  | 'network_explore' | 'detect_org_crime' | 'repeat_offenders'
  | 'offender_risk' | 'mo_similarity' | 'similar_cases'
  | 'case_summary' | 'suggest_leads' | 'money_trail'
  | 'forecast_hotspot' | 'socio_insight'
  | 'clarify' | 'abstain';

export interface IntentResult {
  intent: IntentName;
  slots: Record<string, unknown>;
  confidence: number; // 0-1
}

// ---------- Answer surfaces ----------
export interface MapPoint { lat: number; lng: number; weight?: number; label?: string; fir_id?: string; kind?: 'incident' | 'risk' | 'hotspot'; }
export interface MapAnswer { kind: 'map'; points: MapPoint[]; riskZones?: { lat: number; lng: number; radius_km: number; intensity: number; window?: string }[]; center?: { lat: number; lng: number; zoom?: number }; }

export interface GraphNode { id: string; label: string; group?: number; centrality?: number; kind: 'person' | 'account' | 'location' | 'fir'; flags?: string[]; }
export interface GraphEdge { source: string; target: string; type: string; weight?: number; predicted?: boolean; score?: number; }
export interface GraphAnswer { kind: 'graph'; nodes: GraphNode[]; edges: GraphEdge[]; communities?: Record<string, number>; }

export interface ChartSeries { name: string; points: { x: string | number; y: number }[]; }
export interface ChartAnswer { kind: 'chart'; chartType: 'line' | 'bar' | 'area' | 'scatter'; series: ChartSeries[]; xLabel?: string; yLabel?: string; }

export interface TableAnswer { kind: 'table'; columns: { key: string; label: string }[]; rows: Record<string, unknown>[]; }
export interface CardAnswer { kind: 'card'; title: string; fields: { label: string; value: string }[]; }
export interface TextAnswer { kind: 'text'; }

export type AnswerSurface =
  | MapAnswer | GraphAnswer | ChartAnswer | TableAnswer | CardAnswer | TextAnswer;

// ---------- Evidence / explainability ----------
export interface ReasoningStep { step: string; detail: string; refs?: string[]; }

export interface Evidence {
  fir_ids: string[];
  query: string; // human-readable description of what NETRA ran
  confidence: number; // 0-1
  reasoning_path: ReasoningStep[];
}

// ---------- The uniform answer envelope ----------
export interface AnswerEnvelope {
  intent: IntentName;
  narration_en: string;
  narration_kn?: string;
  surface: AnswerSurface;
  evidence: Evidence;
  followups: string[];
}
