import DashboardShell from '../components/DashboardShell';
import AdminSidebar from '../components/sidebars/AdminSidebar';

export default function AdminLayout() {
  return <DashboardShell Sidebar={AdminSidebar} />;
}
