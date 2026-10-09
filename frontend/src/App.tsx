import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Cows from "./pages/Cows";
import CowDetail from "./pages/CowDetail";
import Assistant from "./pages/Assistant";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="cows" element={<Cows />} />
        <Route path="cows/:id" element={<CowDetail />} />
        <Route path="assistant" element={<Assistant />} />
      </Route>
    </Routes>
  );
}