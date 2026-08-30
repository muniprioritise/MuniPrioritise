import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const navItems = [
  { to: '/overview', label: 'Overview' },
  { to: '/request-map', label: 'Request Map' },
  { to: '/request-table', label: 'Request Table' },
  { to: '/prioritisation-override', label: 'Prioritisation Override' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/reports', label: 'Reports' },
];

function getPageTitle(pathname) {
  const found = navItems.find((item) => pathname.startsWith(item.to));
  return found ? found.label : 'Supervisor Dashboard';
}

function DashboardLayout() {
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="brand-block">
          <p className="brand-kicker">MuniPrioritise</p>
          <h1 className="brand-title">Supervisor Console</h1>
        </div>

        <nav aria-label="Dashboard navigation" className="dashboard-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button type="button" className="logout-btn" onClick={logout}>
          Logout
        </button>
      </aside>

      <div className="dashboard-main-column">
        <header className="dashboard-topbar">
          <div>
            <p className="topbar-kicker">Operations</p>
            <h2 className="topbar-title">{getPageTitle(location.pathname)}</h2>
          </div>
          <div className="topbar-user">
            <span className="topbar-user-name">{user?.full_name || 'Supervisor'}</span>
            <span className="topbar-user-role">{user?.role || 'supervisor'}</span>
          </div>
        </header>

        <main className="dashboard-page-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
