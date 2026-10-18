import { Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import Dashboard from "./pages/Dashboard";
import Workflows from "./pages/Workflows";
import Scrape from "./pages/Scrape";
import DceCache from "./pages/DceCache";
import DceExtraction from "./pages/DceExtraction";
import CronJobs from "./pages/CronJobs";
import AdminTenders from "./pages/Tenders";
import AuditLogs from "./pages/AuditLogs";
import Users from "./pages/Users";
import Roles from "./pages/Roles";
import Costs from "./pages/Costs";
import Settings from "./pages/Settings";
import { EmptyState } from "./components/StateBlock";
import { PageHeader } from "./components/ui";

function ComingSoon({ title, description = "This section is planned but not yet available." }: { title: string; description?: string }) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <EmptyState title="Coming soon" hint="This workflow is planned. No processing or campaign sending is available here yet." />
    </div>
  );
}

export default function AdminApp() {
  return (
    <AdminLayout>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="workflows" element={<Workflows />} />
        <Route path="scrape" element={<Scrape />} />
        <Route path="dce-cache" element={<DceCache />} />
        <Route path="dce-extraction" element={<DceExtraction />} />
        <Route path="video-generation" element={<ComingSoon title="Video generation" description="Planned: use the fiche universelle to generate a short reel for the tender." />} />
        <Route path="awards" element={<ComingSoon title="Résultats & attributions" description="Planned: retrieve award PDFs after the deadline, verify winning suppliers and amounts, and retain the source evidence." />} />
        <Route path="campaigns" element={<ComingSoon title="Campagnes" description="Planned: prepare award-result campaigns, track delivery, and retain campaign history before archiving." />} />
        <Route path="cron" element={<CronJobs />} />
        {/* Old combined page — keep the link working. */}
        <Route path="imports" element={<Navigate to="/admin/scrape" replace />} />
        <Route path="tenders" element={<AdminTenders />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="users" element={<Users />} />
        <Route path="roles" element={<Roles />} />
        <Route path="costs" element={<Costs />} />
        <Route path="settings" element={<Settings />} />
        <Route path="integrations" element={<ComingSoon title="Integrations" />} />
        <Route path="*" element={<EmptyState title="Page not found" hint="This admin page does not exist." />} />
      </Routes>
    </AdminLayout>
  );
}
