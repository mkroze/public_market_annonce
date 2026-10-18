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
import Workflows from "./pages/Workflows";
import Users from "./pages/Users";
import Costs from "./pages/Costs";
import Settings from "./pages/Settings";
import StageShell from "./stages/StageShell";
import PlannedView from "./stages/PlannedView";
import { PLANNED_STAGES } from "./stages/registry";
import { ScrapeControls, ScrapeData, ScrapeLogs } from "./stages/ScrapeViews";
import { DceCacheControls, DceCacheData, DceCacheLogs } from "./stages/DceCacheViews";
import { DceExtractionControls, DceExtractionData, DceExtractionLogs } from "./stages/DceExtractionViews";
import { EmptyState } from "./components/StateBlock";

/** Redirect that carries the query string over, so deep links keep their filters. */
function RedirectWithQuery({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

export default function AdminApp() {
  return (
    <AdminLayout>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="workflows" element={<Workflows />} />

        {/* ── Tender lifecycle ───────────────────────────────────────────── */}
        <Route path="scrape" element={<StageShell slug="scrape" />}>
          <Route index element={<ScrapeControls />} />
          <Route path="data" element={<ScrapeData />} />
          <Route path="logs" element={<ScrapeLogs />} />
        </Route>

        <Route path="dce-cache" element={<StageShell slug="dce-cache" />}>
          <Route index element={<DceCacheControls />} />
          <Route path="data" element={<DceCacheData />} />
          <Route path="logs" element={<DceCacheLogs />} />
        </Route>

        <Route path="dce-extraction" element={<StageShell slug="dce-extraction" />}>
          <Route index element={<DceExtractionControls />} />
          <Route path="data" element={<DceExtractionData />} />
          <Route path="logs" element={<DceExtractionLogs />} />
        </Route>

        {/* Planned stages get the same shell and tabs, with a planned notice. */}
        {PLANNED_STAGES.map((s) => (
          <Route key={s.slug} path={s.slug} element={<StageShell slug={s.slug} />}>
            <Route index element={<PlannedView />} />
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
        <Route path="cron" element={<Navigate to="/admin/workflows" replace />} />
        {/* The audit trail is a tab of the unified journal. */}
        <Route path="audit-logs" element={<RedirectWithQuery to="/admin/workflows?tab=audit" />} />
        {/* The permission matrix is a panel on Users. */}
        <Route path="roles" element={<Navigate to="/admin/users?view=roles" replace />} />
        {/* Older still: the combined imports page. */}
        <Route path="imports" element={<Navigate to="/admin/scrape" replace />} />

        <Route path="*" element={<EmptyState title="Page not found" hint="This admin page does not exist." />} />
      </Routes>
    </AdminLayout>
  );
}
