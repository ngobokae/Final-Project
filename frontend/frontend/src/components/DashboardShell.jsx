import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import AISidebar from './AISidebar';

/**
 * Shared authenticated layout used by every role. Previously each role had a
 * near-identical layout file with a hard-coded `ml-72` that broke on small
 * screens. This shell centralizes the chrome and adds a responsive mobile
 * drawer: the sidebar slides off-canvas below the `lg` breakpoint and is opened
 * via the hamburger in the header.
 *
 * Pass the role's sidebar component as `Sidebar`; it receives `open`/`onClose`.
 */
export default function DashboardShell({ Sidebar }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the drawer whenever the route changes (e.g. after tapping a nav item).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent the page behind the drawer from scrolling while it is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  // Allow Escape to dismiss the drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => e.key === 'Escape' && setMobileOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-background dark:bg-neutral-950">
      {/* Mobile backdrop */}
      <div
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] transition-opacity duration-300 lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="lg:ml-72">
        <Header onMenuClick={() => setMobileOpen((v) => !v)} />
        <main className="px-4 pb-10 pt-20 text-neutral-900 dark:text-neutral-100 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>

      <AISidebar />
    </div>
  );
}
