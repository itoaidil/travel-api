import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layout/AppLayout.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import DriversPage from './pages/DriversPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import TransactionsPage from './pages/TransactionsPage.jsx';
import { hasFranchiseAuthToken } from './services/api.js';

function RequireAuth({ children }) {
  if (!hasFranchiseAuthToken()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

const BASENAME = import.meta.env.BASE_URL?.replace(/\/$/, '') || '/franchise_admin';

function App() {
  return (
    <BrowserRouter basename={BASENAME}>
      <Routes>
        <Route
          path="/login"
          element={hasFranchiseAuthToken() ? <Navigate to="/" replace /> : <LoginPage />}
        />

        <Route
          path="/"
          element={(
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          )}
        >
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="drivers" element={<DriversPage />} />
          <Route path="customers" element={<CustomersPage />} />
        </Route>

        <Route path="*" element={<Navigate to={hasFranchiseAuthToken() ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
