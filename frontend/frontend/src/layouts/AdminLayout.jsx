import { Outlet } from 'react-router-dom';
import AdminSidebar from '../components/sidebars/AdminSidebar';
import Header from '../components/Header';

import AISidebar from '../components/AISidebar';

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-white to-red-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
      <AdminSidebar />
      <div className="ml-72">
        <Header />
        <main className="pt-16 p-6 text-neutral-900 dark:text-neutral-100">
          <Outlet />
        </main>
      </div>
      <AISidebar />
    </div>
  );
}
