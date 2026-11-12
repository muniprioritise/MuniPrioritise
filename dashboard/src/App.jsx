import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import DashboardLayout from './components/DashboardLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import OverviewPage from './pages/OverviewPage.jsx';
import RequestMapPage from './pages/RequestMapPage.jsx';
import RequestsPage from './pages/RequestsPage.jsx';
import PrioritisationOverridePage from './pages/PrioritisationOverridePage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import AlgorithmComparisonPage from './pages/AlgorithmComparisonPage.jsx';
import SimulationPage from './pages/SimulationPage.jsx';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={(
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            )}
          >
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="request-map" element={<RequestMapPage />} />
            <Route path="requests" element={<RequestsPage />} />
            <Route path="request-table" element={<Navigate to="/requests" replace />} />
            <Route path="reports" element={<Navigate to="/requests" replace />} />
            <Route path="prioritisation-override" element={<PrioritisationOverridePage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="benchmarks" element={<AlgorithmComparisonPage />} />
            <Route path="simulation" element={<SimulationPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;