import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Overview from "./pages/Overview";
import Tenders from "./pages/Tenders";
import Stats from "./pages/Stats";
import TenderDetail from "./pages/TenderDetail";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-base-100" data-theme="night">
        <Navbar />
        <main className="max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/tenders" element={<Tenders />} />
            <Route path="/tenders/:id" element={<TenderDetail />} />
            <Route path="/stats" element={<Stats />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
