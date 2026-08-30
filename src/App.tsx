import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import Overview from "@/pages/Overview";
import Explore from "@/pages/Explore";
import Query from "@/pages/Query";
import ObjectDetection from "@/pages/ObjectDetection";
import ChangeDetection from "@/pages/ChangeDetection";
import LandCover from "@/pages/LandCover";
import Measurements from "@/pages/Measurements";
import Projects from "@/pages/Projects";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Help from "@/pages/Help";
import NotFound from "@/pages/NotFound";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Overview />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/query" element={<Query />} />
          <Route path="/object-detection" element={<ObjectDetection />} />
          <Route path="/change-detection" element={<ChangeDetection />} />
          <Route path="/land-cover" element={<LandCover />} />
          <Route path="/measurements" element={<Measurements />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/help" element={<Help />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
