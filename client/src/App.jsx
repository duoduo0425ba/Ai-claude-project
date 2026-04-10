import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import SakuraEffect from './components/SakuraEffect';
import HomePage from './pages/HomePage';
import ListPage from './pages/ListPage';
import ReportPage from './pages/ReportPage';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <SakuraEffect />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/list" element={<ListPage />} />
        <Route path="/report" element={<ReportPage />} />
      </Routes>
      <Navbar />
    </BrowserRouter>
  );
}
