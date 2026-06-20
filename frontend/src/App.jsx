import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Employees from './pages/Employees';
import EmployeeDetail from './pages/EmployeeDetail';
import Attendance from './pages/Attendance';
import Salary from './pages/Salary';
import Clients from './pages/Clients';
import Warehouse from './pages/Warehouse';
import Finance from './pages/Finance';
import Analytics from './pages/Analytics';
import Motivation from './pages/Motivation';
import TelegramSettings from './pages/TelegramSettings';
import Scan from './pages/Scan';
import TvDashboard from './pages/TvDashboard';
import ClientPortal from './pages/ClientPortal';

function isAuthenticated() {
  return !!localStorage.getItem('stitchflow_token');
}

function ProtectedRoute({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/scan/:token" element={<Scan />} />
      <Route path="/tv" element={<TvDashboard />} />
      <Route path="/client/:token" element={<ClientPortal />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="employees" element={<Employees />} />
        <Route path="employees/:id" element={<EmployeeDetail />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="salary" element={<Salary />} />
        <Route path="clients" element={<Clients />} />
        <Route path="warehouse" element={<Warehouse />} />
        <Route path="finance" element={<Finance />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="motivation" element={<Motivation />} />
        <Route path="telegram" element={<TelegramSettings />} />
        <Route path="tv" element={<TvDashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
