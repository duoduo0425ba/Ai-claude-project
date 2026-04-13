import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import SakuraEffect from './components/SakuraEffect';
import HomePage from './pages/HomePage';
import ListPage from './pages/ListPage';
import ReportPage from './pages/ReportPage';
import SettingsPage from './pages/SettingsPage';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <SakuraEffect />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/list" element={<ListPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      <Navbar />
    </BrowserRouter>
  );
}
