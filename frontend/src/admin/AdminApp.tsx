import { Routes, Route } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import Dashboard from "./pages/Dashboard";
import Imports from "./pages/Imports";
import AdminTenders from "./pages/Tenders";
import AuditLogs from "./pages/AuditLogs";
import Users from "./pages/Users";
import Roles from "./pages/Roles";
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
        <Route path="imports" element={<Imports />} />
        <Route path="tenders" element={<AdminTenders />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="users" element={<Users />} />
        <Route path="roles" element={<Roles />} />
        <Route path="settings" element={<ComingSoon title="Settings" />} />
        <Route path="integrations" element={<ComingSoon title="Integrations" />} />
        <Route path="*" element={<EmptyState title="Page not found" hint="This admin page does not exist." />} />
      </Routes>
    </AdminLayout>
  );
}
