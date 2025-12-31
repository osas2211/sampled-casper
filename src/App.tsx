import "./App.module.css";
import { Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home.tsx";
import OnBoardPage from "./pages/OnBoard.tsx";
import { UploadSamplePage } from "./pages/UploadSamplePage.tsx";
import ExplorePage from "./pages/ExplorePage.tsx";
import InAppLayout from "./components/layout/InAppLayout.tsx";
import SamplePage from "./pages/SamplePage.tsx";
import { MarketPlace } from "./components/explore/MarketPlace.tsx";
import MySamplesPage from "./pages/MySamples.tsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/onboard" element={<OnBoardPage />} />
      <Route path="/upload-sample" element={<UploadSamplePage />} />
      <Route element={<InAppLayout />}>
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/my-samples" element={<MySamplesPage />} />
        <Route path="/market/:id" element={<MarketPlace />} />
        <Route path="/sample/:id" element={<SamplePage />} />
      </Route>
    </Routes>
  );
}

export default App;
