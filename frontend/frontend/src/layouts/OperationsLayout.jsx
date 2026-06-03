import DashboardShell from '../components/DashboardShell';
import OperationsSidebar from '../components/sidebars/OperationsSidebar';

export default function OperationsLayout() {
  return <DashboardShell Sidebar={OperationsSidebar} />;
}
