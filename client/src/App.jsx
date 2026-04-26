import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import SakuraEffect from './components/SakuraEffect';
import HomePage from './pages/HomePage';
import ListPage from './pages/ListPage';
import ReportPage from './pages/ReportPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import './index.css';

// 登录后的布局：显示 Navbar + 樱花效果
function AuthLayout() {
  const token = sessionStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return (
    <>
      <SakuraEffect />
      <Outlet />
      <Navbar />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<AuthLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/list" element={<ListPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
