import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Navbar from "./components/Navbar";
import VerificationBanner from "./components/VerificationBanner";
import Tenders from "./pages/Tenders";
import TenderDetail from "./pages/TenderDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Alerts from "./pages/Alerts";
import MemberLayout from "./components/MemberLayout";
import MemberOverview from "./pages/member/MemberOverview";
import MemberConsultations from "./pages/member/MemberConsultations";
import MemberSavedSearches from "./pages/member/MemberSavedSearches";
import MemberAccount from "./pages/member/MemberAccount";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Faq from "./pages/Faq";
import LegalNotice from "./pages/legal/LegalNotice";
import Privacy from "./pages/legal/Privacy";
import Terms from "./pages/legal/Terms";
import Cookies from "./pages/legal/Cookies";
import Footer from "./components/Footer";
import Ambiance from "./components/Ambiance";
import AdminGuard from "./admin/AdminGuard";

const CandidacyAssistant = lazy(() => import("./pages/CandidacyAssistant"));
const Guide = lazy(() => import("./pages/Guide"));
const Procedures = lazy(() => import("./pages/Procedures"));
const ProcedureDetail = lazy(() => import("./pages/ProcedureDetail"));
const Eligibility = lazy(() => import("./pages/Eligibility"));
const Recours = lazy(() => import("./pages/Recours"));
// Statistiques & annuaires de données publiques (Epic 2) — chargés à la demande.
const Stats = lazy(() => import("./pages/Stats"));
const Cities = lazy(() => import("./pages/Cities"));
const CityDetail = lazy(() => import("./pages/CityDetail"));
const Regions = lazy(() => import("./pages/Regions"));
const RegionDetail = lazy(() => import("./pages/RegionDetail"));
const Sectors = lazy(() => import("./pages/Sectors"));
const SectorDetail = lazy(() => import("./pages/SectorDetail"));
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
    <div className="relative min-h-screen flex flex-col institutional-page">
      <Ambiance />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:top-2 focus:left-2 focus:rounded focus:bg-[var(--color-crimson)] focus:px-3 focus:py-2 focus:text-[var(--color-ivory)] focus:font-sans focus:text-sm"
      >
        Aller au contenu
      </a>
      <Navbar />
      <VerificationBanner />
      <main id="main-content" className="relative z-10 flex-1 w-full max-w-[1440px] mx-auto">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/tenders" element={<Tenders />} />
          <Route path="/tenders/:id" element={<TenderDetail />} />
          <Route
            path="/assistant"
            element={
              <RequireAuth>
                <Suspense fallback={authSpinner}>
                  <CandidacyAssistant />
                </Suspense>
              </RequireAuth>
            }
          />
          <Route
            path="/guide"
            element={
              <Suspense fallback={authSpinner}>
                <Guide />
              </Suspense>
            }
          />
          <Route
            path="/procedures"
            element={
              <Suspense fallback={authSpinner}>
                <Procedures />
              </Suspense>
            }
          />
          <Route
            path="/procedures/:slug"
            element={
              <Suspense fallback={authSpinner}>
                <ProcedureDetail />
              </Suspense>
            }
          />
          <Route
            path="/eligibility"
            element={
              <Suspense fallback={authSpinner}>
                <Eligibility />
              </Suspense>
            }
          />
          <Route
            path="/recours"
            element={
              <Suspense fallback={authSpinner}>
                <Recours />
              </Suspense>
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

          {/* Espace membre : coquille protégée avec routes imbriquées. */}
          <Route
            path="/member"
            element={
              <RequireAuth>
                <MemberLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/member/overview" replace />} />
            <Route path="overview" element={<MemberOverview />} />
            <Route path="consultations" element={<MemberConsultations />} />
            <Route path="alerts" element={<Alerts embedded />} />
            <Route path="saved-searches" element={<MemberSavedSearches />} />
            <Route path="account" element={<MemberAccount />} />
          </Route>

          {/* Statistiques & annuaires publics (Epic 2) — données agrégées, sans connexion.
              La racine reste inchangée : pas de page d'accueil déconnectée ici (Epic 4). */}
          <Route path="/stats" element={<Suspense fallback={authSpinner}><Stats /></Suspense>} />
          <Route path="/cities" element={<Suspense fallback={authSpinner}><Cities /></Suspense>} />
          <Route path="/cities/:name" element={<Suspense fallback={authSpinner}><CityDetail /></Suspense>} />
          <Route path="/regions" element={<Suspense fallback={authSpinner}><Regions /></Suspense>} />
          <Route path="/regions/:name" element={<Suspense fallback={authSpinner}><RegionDetail /></Suspense>} />
          <Route path="/sectors" element={<Suspense fallback={authSpinner}><Sectors /></Suspense>} />
          <Route path="/sectors/:code" element={<Suspense fallback={authSpinner}><SectorDetail /></Suspense>} />

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
