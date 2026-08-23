import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Navbar from "./components/Navbar";
import Tenders from "./pages/Tenders";
import TenderDetail from "./pages/TenderDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Alerts from "./pages/Alerts";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Faq from "./pages/Faq";
import LegalNotice from "./pages/legal/LegalNotice";
import Privacy from "./pages/legal/Privacy";
import Terms from "./pages/legal/Terms";
import Cookies from "./pages/legal/Cookies";
import Footer from "./components/Footer";
import AdminGuard from "./admin/AdminGuard";

// L'espace admin est isolé et chargé à la demande (bundle séparé).
const AdminApp = lazy(() => import("./admin/AdminApp"));

const authSpinner = (
  <div className="flex justify-center py-20">
    <span className="loading loading-spinner loading-lg text-[var(--color-crimson)]"></span>
  </div>
);

// La consultation des appels d'offres est réservée aux comptes enregistrés :
// les visiteurs non connectés sont redirigés vers la connexion.
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return authSpinner;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col institutional-page">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:top-2 focus:left-2 focus:rounded focus:bg-[var(--color-crimson)] focus:px-3 focus:py-2 focus:text-[var(--color-ivory)] focus:font-sans focus:text-sm"
      >
        Aller au contenu
      </a>
      <Navbar />
      <main id="main-content" className="flex-1 w-full max-w-[1440px] mx-auto">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/tenders"
            element={
              <RequireAuth>
                <Tenders />
              </RequireAuth>
            }
          />
          <Route
            path="/tenders/:id"
            element={
              <RequireAuth>
                <TenderDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/alerts"
            element={
              <RequireAuth>
                <Alerts />
              </RequireAuth>
            }
          />

          {/* Pages de contenu publiques (accessibles sans connexion) */}
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/legal/mentions-legales" element={<LegalNotice />} />
          <Route path="/legal/confidentialite" element={<Privacy />} />
          <Route path="/legal/conditions" element={<Terms />} />
          <Route path="/legal/cookies" element={<Cookies />} />

          <Route path="/" element={<Navigate to="/tenders" replace />} />
          <Route path="*" element={<Navigate to="/tenders" replace />} />
        </Routes>
      </main>
      <Footer />
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
