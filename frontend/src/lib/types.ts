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

export interface StatsResponse {
  total: number;
  by_category: { category: string; count: number }[];
  top_sectors: { sector_code: string; sector_name: string; category: string; count: number }[];
  top_entities: { entity: string; count: number }[];
}

export interface FiltersResponse {
  categories: { code: string; name: string }[];
  sectors: { code: string; name: string }[];
  entities: string[];
  locations: string[];
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
}

export interface TenderFilters {
  q: string;
  category: string;
  sector: string;
  entity: string;
  location: string;
  sort: string;
  order: string;
  page: number;
}
