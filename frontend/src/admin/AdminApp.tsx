// Admin routing, organised around the tender lifecycle. Each lifecycle stage is
// a StageShell with three routed views (Controls / Data / Logs) hanging off its
// path, so every stage is operated, inspected and audited in the same place.
//
// The former standalone Cron jobs, Tenders, Audit logs and Roles pages were
// folded into the stage or owner that already had their subject matter; the
// redirects below keep old links and bookmarks working.
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Costs from "./pages/Costs";
import Settings from "./pages/Settings";
import StageShell from "./stages/StageShell";
import PlannedView from "./stages/PlannedView";
import { PLANNED_STAGES } from "./stages/registry";
import { ScrapeData, ScrapeLogs } from "./stages/ScrapeViews";
import { DceCacheData, DceCacheLogs } from "./stages/DceCacheViews";
import { DceExtractionData, DceExtractionLogs } from "./stages/DceExtractionViews";
import { EmptyState } from "./components/StateBlock";
import CadreEtape from "./stages/CadreEtape";
import StageScheduleCard from "./stages/StageScheduleCard";

/** Redirect that carries the query string over, so deep links keep their filters. */
function RedirectWithQuery({ to }: { to: string }) {
  const { search } = useLocation();
  const [pathname, query = ""] = to.split("?");
  const merged = new URLSearchParams(search);
  new URLSearchParams(query).forEach((value, key) => merged.set(key, value));
  const suffix = merged.toString();
  return <Navigate to={`${pathname}${suffix ? `?${suffix}` : ""}`} replace />;
}

export default function AdminApp() {
  return (
    <AdminLayout>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="workflows" element={<RedirectWithQuery to="/admin" />} />

        {/* ── Tender lifecycle ───────────────────────────────────────────── */}
        <Route path="scrape" element={<StageShell slug="scrape" />}>
          <Route index element={<CadreEtape />} />
          <Route path="schedules" element={<StageScheduleCard />} />
          <Route path="data" element={<ScrapeData />} />
          <Route path="logs" element={<ScrapeLogs />} />
        </Route>

        <Route path="dce-cache" element={<StageShell slug="dce-cache" />}>
          <Route index element={<CadreEtape />} />
          <Route path="schedules" element={<StageScheduleCard />} />
          <Route path="data" element={<DceCacheData />} />
          <Route path="logs" element={<DceCacheLogs />} />
        </Route>

        <Route path="dce-extraction" element={<StageShell slug="dce-extraction" />}>
          <Route index element={<CadreEtape />} />
          <Route path="schedules" element={<StageScheduleCard />} />
          <Route path="data" element={<DceExtractionData />} />
          <Route path="logs" element={<DceExtractionLogs />} />
        </Route>

        {/* Planned stages get the same shell and tabs, with a planned notice. */}
        {PLANNED_STAGES.map((s) => (
          <Route key={s.slug} path={s.slug} element={<StageShell slug={s.slug} />}>
            <Route index element={<CadreEtape />} />
            <Route path="schedules" element={<StageScheduleCard />} />
            <Route path="data" element={<PlannedView />} />
            <Route path="logs" element={<PlannedView />} />
          </Route>
        ))}

        {/* ── Administration ────────────────────────────────────────────── */}
        <Route path="users" element={<Users />} />
        <Route path="costs" element={<Costs />} />
        <Route path="settings" element={<Settings />} />

        {/* ── Folded-away pages: keep old links working ─────────────────── */}
        {/* The catalog is now stage 01's Data view; filters must survive. */}
        <Route path="tenders" element={<RedirectWithQuery to="/admin/scrape/data" />} />
        {/* Schedules are edited per stage; the journal lists them all. */}
        <Route path="cron" element={<Navigate to="/admin" replace />} />
        {/* The audit trail is a tab of the unified journal. */}
        <Route path="audit-logs" element={<RedirectWithQuery to="/admin?tab=audit" />} />
        {/* The permission matrix is a panel on Users. */}
        <Route path="roles" element={<Navigate to="/admin/users?view=roles" replace />} />
        {/* Older still: the combined imports page. */}
        <Route path="imports" element={<Navigate to="/admin/scrape" replace />} />

        <Route path="*" element={<EmptyState title="Page not found" hint="This admin page does not exist." />} />
      </Routes>
    </AdminLayout>
  );
}
