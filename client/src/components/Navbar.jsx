import { NavLink } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <NavLink
          to="/"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          id="nav-home"
        >
          <span className="nav-icon">✏️</span>
          <span>记账</span>
        </NavLink>
        <NavLink
          to="/list"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          id="nav-list"
        >
          <span className="nav-icon">📋</span>
          <span>账单</span>
        </NavLink>
        <NavLink
          to="/report"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          id="nav-report"
        >
          <span className="nav-icon">📊</span>
          <span>报表</span>
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          id="nav-settings"
        >
          <span className="nav-icon">⚙️</span>
          <span>设置</span>
        </NavLink>
      </div>
    </nav>
  );
}
