import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConfirmDialogProvider } from './contexts/ConfirmDialogContext';
import { useEffect } from 'react';
import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './layouts/AdminLayout';
import OperationsLayout from './layouts/OperationsLayout';
import InventoryLayout from './layouts/InventoryLayout';
import ExecutiveLayout from './layouts/ExecutiveLayout';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import UsersPage from './pages/admin/Users';
import SystemSettings from './pages/admin/SystemSettings';
import AIModels from './pages/admin/AIModels';
import AuditLogs from './pages/admin/AuditLogs';
import PermissionsPage from './pages/admin/Permissions';

// Operations Pages
import OperationsDashboard from './pages/operations/Dashboard';
import SalesData from './pages/operations/SalesData';
import DemandForecast from './pages/operations/DemandForecast';
import ProductionPlan from './pages/operations/ProductionPlan';
import ProcurementPlan from './pages/operations/ProcurementPlan';
import OperationsReports from './pages/operations/Reports';

// Inventory Pages
import InventoryDashboard from './pages/inventory/Dashboard';
import StockOverview from './pages/inventory/StockOverview';
import StockTransactions from './pages/inventory/StockTransactions';
import Optimization from './pages/inventory/Optimization';
import Alerts from './pages/inventory/Alerts';
import InventoryReports from './pages/inventory/Reports';
import WarehouseMap from './pages/inventory/WarehouseMap';
import QRLabelGenerator from './pages/inventory/QRLabelGenerator';

// Executive Pages
import ExecutiveDashboard from './pages/executive/Dashboard';
import KPIs from './pages/executive/KPIs';
import Insights from './pages/executive/Insights';
import ExecutiveReports from './pages/executive/Reports';
import AIHub from './pages/executive/AIHub';
import ExecutiveSimulator from './pages/executive/Simulator';

// Shared (all roles)
import Profile from './pages/shared/Profile';
import Messages from './pages/shared/Messages';

// Auth extras
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

import CommandPalette from './components/CommandPalette';

function AppContent() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    const applyTitle = () => {
      try {
        const siteName = localStorage.getItem('site_name') || 'Kinglion';
        document.title = siteName;
      } catch {
        document.title = 'Kinglion';
      }
    };
    applyTitle();
    window.addEventListener('app:site-name-changed', applyTitle);
    return () => window.removeEventListener('app:site-name-changed', applyTitle);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <CommandPalette />
      <Routes>
        <Route path="/" element={user ? <Navigate to={`/${user.role}`} replace /> : <Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forget-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Admin Routes */}
        <Route path="/admin/*" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="permissions" element={<PermissionsPage />} />
          <Route path="system-settings" element={<SystemSettings />} />
          <Route path="ai-models" element={<AIModels />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="profile" element={<Profile />} />
          <Route path="messages" element={<Messages />} />
        </Route>

        {/* Operations Routes */}
        <Route path="/operations/*" element={
          <ProtectedRoute allowedRoles={['operations']}>
            <OperationsLayout />
          </ProtectedRoute>
        }>
          <Route index element={<OperationsDashboard />} />
          <Route path="dashboard" element={<OperationsDashboard />} />
          <Route path="sales-data" element={<SalesData />} />
          <Route path="demand-forecast" element={<DemandForecast />} />
          <Route path="production-plan" element={<ProductionPlan />} />
          <Route path="procurement-plan" element={<ProcurementPlan />} />
          <Route path="reports" element={<OperationsReports />} />
          <Route path="profile" element={<Profile />} />
          <Route path="messages" element={<Messages />} />
        </Route>

        {/* Inventory Routes */}
        <Route path="/inventory/*" element={
          <ProtectedRoute allowedRoles={['inventory']}>
            <InventoryLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/inventory/dashboard" replace />} />
          <Route path="dashboard" element={<InventoryDashboard />} />
          <Route path="stock-overview" element={<StockOverview />} />
          <Route path="stock-transactions" element={<StockTransactions />} />
          <Route path="optimization" element={<Optimization />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="warehouse-map" element={<WarehouseMap />} />
          <Route path="labels" element={<QRLabelGenerator />} />
          <Route path="reports" element={<InventoryReports />} />
          <Route path="profile" element={<Profile />} />
          <Route path="messages" element={<Messages />} />
        </Route>

        {/* Executive Routes */}
        <Route path="/executive/*" element={
          <ProtectedRoute allowedRoles={['executive']}>
            <ExecutiveLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/executive/dashboard" replace />} />
          <Route path="dashboard" element={<ExecutiveDashboard />} />
          <Route path="kpis" element={<KPIs />} />
          <Route path="insights" element={<Insights />} />
          <Route path="reports" element={<ExecutiveReports />} />
          <Route path="ai-hub" element={<AIHub />} />
          <Route path="simulator" element={<ExecutiveSimulator />} />
          <Route path="profile" element={<Profile />} />
          <Route path="messages" element={<Messages />} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ConfirmDialogProvider>
        <Router>
          <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
            <AppContent />
          </div>
        </Router>
      </ConfirmDialogProvider>
    </AuthProvider>
  );
}
