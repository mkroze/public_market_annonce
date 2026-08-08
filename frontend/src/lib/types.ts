export interface Tender {
  id: string;
  reference: string;
  title: string;
  entity: string;
  entity_code: string;
  sector_code: string;
  sector_name: string;
  category: string;
  deadline: string;
  publication_date: string;
  status: string;
  procedure_type: string;
  location: string;
  detail_url: string;
  scraped_at: string;
  estimation?: string;
}

export interface TenderListResponse {
  total: number;
  page: number;
  per_page: number;
  pages: number;
  data: Tender[];
}

export interface SectorCount {
  category: string;
  sector_code: string;
  sector_name: string;
  count: number;
}

export interface OverviewResponse {
  total_active: number;
  sectors: SectorCount[];
}

export interface StatsKpis {
  active: number;
  closing_7d: number;
  new_7d: number;
  distinct_buyers: number;
}

export interface StatsResponse {
  total: number;
  by_category: { category: string; count: number }[];
  top_sectors: { sector_code: string; sector_name: string; category: string; count: number }[];
  top_entities: { entity: string; count: number }[];
  kpis?: StatsKpis;
  by_procedure?: { procedure_type: string; count: number }[];
}

export interface FiltersResponse {
  categories: { code: string; name: string }[];
  sectors: { code: string; name: string }[];
  entities: string[];
  locations: string[];
  statuses: string[];
  procedure_types: string[];
}

export type DisplayValueStatus = "detected" | "missing" | "not_applicable" | "needs_verification";
export type DisplayValueSource = "base" | "detail" | "regex" | "agent_import" | "computed" | "none";
export type DisplayValueConfidence = "high" | "medium" | "low" | "none";

export interface DisplayValue {
  value: string | number | boolean | null;
  status: DisplayValueStatus;
  source: DisplayValueSource;
  confidence: DisplayValueConfidence;
  raw?: string;
}

export interface TenderDisplay {
  title: DisplayValue;
  buyer: DisplayValue;
  location: DisplayValue;
  procedure: DisplayValue;
  category: DisplayValue;
  deadline: DisplayValue;
  reference: DisplayValue;
}

export interface TenderSignals {
  estimation: DisplayValue;
  caution: DisplayValue;
  plan_price: DisplayValue;
  dce_available: DisplayValue;
  applications_count: DisplayValue;
  market_price: DisplayValue;
}

export interface TenderDetail {
  objet: string;
  acheteur: string;
  annonce_type: string;
  procedure: string;
  categorie: string;
  allotissement: string;
  lieu_execution: string;
  estimation: string;
  domaines: string;
  adresse_retrait: string;
  adresse_depot: string;
  lieu_ouverture: string;
  caution_provisoire: string;
  qualifications: string;
  agrements: string;
  variante: string;
  reunion: string;
  visite_lieux: string;
  contact: string;
  documents_url: string;
  dce_url: string;
  avis_url: string;
  reserved_pme: string;
  prix_plans: string;
}

export interface TenderWithDetails extends Tender {
  details?: TenderDetail;
  display?: TenderDisplay;
  signals?: TenderSignals;
}

export interface TenderFilters {
  q: string;
  category: string;
  sector: string;
  entity: string;
  location: string;
  status: string;
  procedure_type: string;
  sort: string;
  order: string;
  page: number;
  per_page: number;
}

// Auth
export interface User {
  id: number;
  email: string;
  name: string;
  plan: string;
  company?: string;
  role?: string;
  status?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Cities
export interface CityStats {
  name: string;
  total: number;
  active: number;
  region: string;
}

export interface CityDetail {
  name: string;
  region: string;
  total: number;
  active: number;
  by_category: { category: string; count: number }[];
  top_sectors: { sector_code: string; sector_name: string; count: number }[];
}

// Regions
export interface RegionStats {
  name: string;
  total: number;
  active: number;
  cities: string[];
}

export interface RegionDetail {
  name: string;
  total: number;
  active: number;
  cities: { location: string; total: number }[];
  by_category: { category: string; count: number }[];
  top_sectors: { sector_code: string; sector_name: string; count: number }[];
}

// Sectors
export interface SectorInfo {
  sector_code: string;
  sector_name: string;
  category: string;
  count: number;
}

export interface SectorCategory {
  name: string;
  total: number;
  sectors: SectorInfo[];
}

export interface SectorDetailResponse {
  code: string;
  name: string;
  total: number;
  active: number;
  top_entities: { entity: string; count: number }[];
  top_locations: { location: string; count: number }[];
}

// Alerts
export interface AlertPreference {
  id: number;
  user_id: number;
  name: string;
  sectors: string;
  regions: string;
  keywords: string;
  min_budget: string;
  max_budget: string;
  frequency: string;
  enabled: number;
  created_at: string;
  last_sent?: string | null;
}

export interface AlertPreview {
  count: number;
  sample: { id: string; title: string; entity: string; location: string; deadline: string }[];
}

// Blog
export interface BlogPost {
  slug: string;
  title: string;
  summary: string;
  category: string;
  date: string;
  content?: string;
}
