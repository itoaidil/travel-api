import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getStoredFranchiseProfile, logoutFranchiseAdmin } from '../services/api.js';

const menus = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/transactions', label: 'Transaksi' },
  { to: '/drivers', label: 'Driver' },
  { to: '/customers', label: 'Customer' }
];

function AppLayout() {
  const navigate = useNavigate();
  const profile = getStoredFranchiseProfile();

  function handleLogout() {
    logoutFranchiseAdmin();
    navigate('/login', { replace: true });
  }

  return (
    <div className="dashboard-shell">
      <div className="bg-glow bg-glow-a" />
      <div className="bg-glow bg-glow-b" />

      <header className="topbar">
        <div>
          <p className="eyebrow">PRIMARY LINE INDONESIA</p>
          <h1>Franchise Performance Command Center</h1>
          <p className="subtext">
            Pantau transaksi, pendapatan, driver, dan customer dalam satu dashboard operasional.
            {profile?.franchise_name ? ` | ${profile.franchise_name}` : ''}
          </p>
        </div>
        <div className="topbar-actions">
          <button className="ghost-btn">Export PDF</button>
          <button className="solid-btn" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <nav className="menu-bar">
        {menus.map((menu) => (
          <NavLink key={menu.to} to={menu.to} end={menu.end} className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}>
            {menu.label}
          </NavLink>
        ))}
      </nav>

      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
