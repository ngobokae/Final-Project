import DashboardShell from '../components/DashboardShell';
import InventorySidebar from '../components/sidebars/InventorySidebar';

export default function InventoryLayout() {
  return <DashboardShell Sidebar={InventorySidebar} />;
}
