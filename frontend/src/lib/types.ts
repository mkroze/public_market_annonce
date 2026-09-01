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
  caution_provisoire?: string;
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
  regions: string[];
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
  tender_id?: string;
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
  scraped_at?: string;
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
export type ThemePreference = "system" | "light" | "dark";

export interface User {
  id: number;
  email: string;
  name: string;
  plan: string;
  company?: string;
  phone?: string;
  role?: string;
  status?: string;
  theme?: ThemePreference;
  created_at?: string | null;
  last_login?: string | null;
}

export interface AccountProfile extends User {
  theme: ThemePreference;
  company: string;
  phone: string;
  role: string;
  status: string;
  created_at?: string | null;
  last_login?: string | null;
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

// Confirmation-email outcome returned by create/update so the UI can tell the
// user whether the alert saved AND whether the confirmation email went out.
export interface EmailDeliveryStatus {
  attempted: boolean;
  delivered: boolean;
  reason: string | null;
}

export interface AlertMutationResult {
  id?: number;
  status: string;
  email: EmailDeliveryStatus;
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
