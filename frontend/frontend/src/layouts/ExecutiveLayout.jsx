import { Outlet } from 'react-router-dom';
import ExecutiveSidebar from '../components/sidebars/ExecutiveSidebar';
import Header from '../components/Header';
import AISidebar from '../components/AISidebar';

export default function ExecutiveLayout() {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-white via-white to-red-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
      <ExecutiveSidebar />
      <div className="flex-1 flex flex-col ml-72">
        <Header />
        <main className="flex-1 pt-16 p-8 text-neutral-900 dark:text-neutral-100">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <AISidebar />
    </div>
  );
}
