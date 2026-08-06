import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import Navbar from "./components/Navbar";
import Tenders from "./pages/Tenders";
import TenderDetail from "./pages/TenderDetail";
import Login from "./pages/Login";
import AdminGuard from "./admin/AdminGuard";

// L'espace admin est isolé et chargé à la demande (bundle séparé).
const AdminApp = lazy(() => import("./admin/AdminApp"));

function PublicLayout() {
  return (
    <div className="min-h-screen bg-base-100" data-theme="academic">
      <Navbar />
      <main className="max-w-7xl mx-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/tenders" replace />} />
          <Route path="/tenders" element={<Tenders />} />
          <Route path="/tenders/:id" element={<TenderDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/tenders" replace />} />
        </Routes>
      </main>
    </div>
  );
}

const adminFallback = (
  <div className="min-h-screen flex justify-center py-20 bg-[var(--color-ivory)]">
    <span className="loading loading-spinner loading-lg text-[var(--color-crimson)]"></span>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/admin/*"
            element={
              <Suspense fallback={adminFallback}>
                <AdminGuard>
                  <AdminApp />
                </AdminGuard>
              </Suspense>
            }
          />
          <Route path="/*" element={<PublicLayout />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
