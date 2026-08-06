export interface ImportRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  tenders_found: number;
  tenders_new: number;
  tenders_updated: number;
  tenders_skipped: number;
  status: string; // running | done | failed
  error: string | null;
  actor_email: string | null;
  trigger: string | null; // manual | scheduled
  warnings: string | null;
}

export interface AdminOverview {
  last_import: ImportRun | null;
  freshness: {
    tender_count: number;
    detail_count: number;
    detail_coverage_pct: number;
    last_scraped_at: string | null;
    last_successful_import_at: string | null;
    source: string;
  };
  failure_queues: {
    failed_imports: number;
    missing_details: number;
    flagged_tenders: number;
    archived_tenders: number;
    stale_records: number;
  };
  governance: AuditEvent[];
  health: {
    database: string;
    scraper_source: string;
    scraper_last_attempt_at: string | null;
  };
}

export interface AdminTender {
  id: string;
  reference: string;
  title: string;
  entity: string;
  sector_code: string;
  sector_name: string;
  category: string;
  deadline: string;
  publication_date: string;
  status: string;
  procedure_type: string;
  location: string;
  scraped_at: string;
  admin_status: string;
  review_status: string;
  flag_note: string | null;
  detail_available: number;
  estimation: string | null;
}

export interface Paginated<T> {
  total: number;
  page: number;
  per_page: number;
  pages: number;
  data: T[];
}

export interface BatchResult {
  action: string;
  updated: string[];
  failed: { id: string; reason: string }[];
  result: "success" | "partial" | "failure";
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  company: string;
  plan: string;
  role: string;
  status: string;
  last_login: string | null;
  mfa_enabled: number;
  invited_by: number | null;
  created_at: string;
}

export interface RoleInfo {
  name: string;
  description: string;
  permissions: string[];
}

export interface AuditEvent {
  id: number;
  actor_id: number | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  result: string;
  ip: string | null;
  route: string | null;
  before_json: string | null;
  after_json: string | null;
  created_at: string;
}
