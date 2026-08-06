import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import Navbar from "./components/Navbar";
import Overview from "./pages/Overview";
import Tenders from "./pages/Tenders";
import TenderDetail from "./pages/TenderDetail";
import Stats from "./pages/Stats";
import Cities from "./pages/Cities";
import CityDetail from "./pages/CityDetail";
import Regions from "./pages/Regions";
import RegionDetail from "./pages/RegionDetail";
import Sectors from "./pages/Sectors";
import SectorDetail from "./pages/SectorDetail";
import Pricing from "./pages/Pricing";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Calculator from "./pages/Calculator";
import Procedures from "./pages/Procedures";
import ProcedureDetail from "./pages/ProcedureDetail";
import Eligibility from "./pages/Eligibility";
import Recours from "./pages/Recours";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Alerts from "./pages/Alerts";
import Favorites from "./pages/Favorites";
import Partners from "./pages/Partners";
import AdminGuard from "./admin/AdminGuard";

// Chargé à la demande pour ne pas alourdir le bundle des pages de consultation
const CandidacyAssistant = lazy(() => import("./pages/CandidacyAssistant"));
const Guide = lazy(() => import("./pages/Guide"));
// L'espace admin est isolé et chargé à la demande (bundle séparé).
const AdminApp = lazy(() => import("./admin/AdminApp"));

function PublicLayout() {
  return (
    <div className="min-h-screen bg-base-100" data-theme="academic">
      <Navbar />
      <main className="max-w-7xl mx-auto">
        <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/tenders" element={<Tenders />} />
              <Route path="/tenders/:id" element={<TenderDetail />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/cities" element={<Cities />} />
              <Route path="/cities/:name" element={<CityDetail />} />
              <Route path="/regions" element={<Regions />} />
              <Route path="/regions/:name" element={<RegionDetail />} />
              <Route path="/sectors" element={<Sectors />} />
              <Route path="/sectors/:code" element={<SectorDetail />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/calculator" element={<Calculator />} />
              <Route path="/procedures" element={<Procedures />} />
              <Route path="/procedures/:slug" element={<ProcedureDetail />} />
              <Route path="/eligibility" element={<Eligibility />} />
              <Route
                path="/assistant"
                element={
                  <Suspense
                    fallback={
                      <div className="flex justify-center py-20">
                        <span className="loading loading-spinner loading-lg text-[var(--color-crimson)]"></span>
                      </div>
                    }
                  >
                    <CandidacyAssistant />
                  </Suspense>
                }
              />
              <Route
                path="/guide"
                element={
                  <Suspense
                    fallback={
                      <div className="flex justify-center py-20">
                        <span className="loading loading-spinner loading-lg text-[var(--color-crimson)]"></span>
                      </div>
                    }
                  >
                    <Guide />
                  </Suspense>
                }
              />
              <Route path="/recours" element={<Recours />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/partenaires" element={<Partners />} />
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
