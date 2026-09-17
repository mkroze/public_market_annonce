import { Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import Dashboard from "./pages/Dashboard";
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

function ComingSoon({ title }: { title: string }) {
  return (
    <div>
      <PageHeader title={title} description="This section is planned but not yet available." />
      <EmptyState title="Coming soon" hint="Settings and integrations will be added in a future iteration." />
    </div>
  );
}

export default function AdminApp() {
  return (
    <AdminLayout>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="scrape" element={<Scrape />} />
        <Route path="dce-cache" element={<DceCache />} />
        <Route path="dce-extraction" element={<DceExtraction />} />
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
