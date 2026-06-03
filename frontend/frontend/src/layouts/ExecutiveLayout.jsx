import DashboardShell from '../components/DashboardShell';
import ExecutiveSidebar from '../components/sidebars/ExecutiveSidebar';

export default function ExecutiveLayout() {
  return <DashboardShell Sidebar={ExecutiveSidebar} />;
}
