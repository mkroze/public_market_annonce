import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Tenders from "./pages/Tenders";
import TenderDetail from "./pages/TenderDetail";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-base-100" data-theme="academic">
        <Navbar />
        <main className="max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/tenders" replace />} />
            <Route path="/tenders" element={<Tenders />} />
            <Route path="/tenders/:id" element={<TenderDetail />} />
            <Route path="*" element={<Navigate to="/tenders" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
