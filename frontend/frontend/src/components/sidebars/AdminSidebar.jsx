import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Users, Settings, Brain, FileText, BarChart3, ChevronRight, Lock, User, MessageSquare } from 'lucide-react';
import logoSrc from '../../assets/IMG_1472.PNG';
import { apiGet } from '../../utils/api';

export default function AdminSidebar() {
  const [counts, setCounts] = useState({ users: 0, models: 0 });

  useEffect(() => {
    let mounted = true;
    const loadCounts = async () => {
      try {
        const [usersRes, modelsRes] = await Promise.all([
          apiGet('/api/users').catch(() => ({ users: [] })),
          apiGet('/api/demand-models').catch(() => ({ models: [] }))
        ]);

        const users = Array.isArray(usersRes) ? usersRes : usersRes?.users || usersRes?.data || [];
        const models = Array.isArray(modelsRes) ? modelsRes : modelsRes?.models || modelsRes?.data || [];

        if (!mounted) return;
        setCounts({
          users: Array.isArray(users) ? users.length : 0,
          models: Array.isArray(models) ? models.length : 0
        });
      } catch {
        if (!mounted) return;
        setCounts({ users: 0, models: 0 });
      }
    };

    loadCounts();
    window.addEventListener('app:operations-data-updated', loadCounts);
    window.addEventListener('app:notifications-changed', loadCounts);
    window.addEventListener('app:forecasts-updated', loadCounts);
    return () => {
      mounted = false;
      window.removeEventListener('app:operations-data-updated', loadCounts);
      window.removeEventListener('app:notifications-changed', loadCounts);
      window.removeEventListener('app:forecasts-updated', loadCounts);
    };
  }, []);

  const menuSections = [
    {
      title: 'Overview',
      items: [
        { to: '/admin/dashboard', icon: BarChart3, label: 'Dashboard', badge: null }
      ]
    },
    {
      title: 'Management',
      items: [
        { to: '/admin/users', icon: Users, label: 'Users', badge: counts.users > 0 ? String(counts.users) : null },
        { to: '/admin/permissions', icon: Lock, label: 'Roles & Permissions', badge: null },
        { to: '/admin/system-settings', icon: Settings, label: 'System Settings', badge: null },
        { to: '/admin/ai-models', icon: Brain, label: 'AI Models', badge: counts.models > 0 ? String(counts.models) : null }
      ]
    },
    {
      title: 'Security',
      items: [
        { to: '/admin/audit-logs', icon: FileText, label: 'Audit Logs', badge: null }
      ]
    },
    {
      title: 'Account',
      items: [
        { to: '/admin/profile', icon: User, label: 'Profile', badge: null },
        { to: '/admin/messages', icon: MessageSquare, label: 'Messages', badge: null }
      ]
    }
  ];

  return (
    <aside className="fixed left-0 top-0 w-72 bg-gradient-to-b from-neutral-950 via-neutral-900 to-red-800 text-white h-screen overflow-y-auto z-40 border-r border-red-950/50 shadow-2xl">
      <div className="p-6 border-b border-neutral-800 bg-neutral-950/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-2">
          <img
            src={logoSrc}
            alt="Kinglion"
            className="h-14 w-auto max-w-[96px] object-contain"
          />
          <div>
            <h2 className="text-lg font-bold text-white">Kinglion</h2>
            <p className="text-xs text-neutral-300">Admin Panel</p>
          </div>
        </div>
      </div>

      <nav className="p-4 space-y-6">
        {menuSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-3 mb-2">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `group flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-neutral-900 to-red-800 text-white shadow-lg shadow-black/20 scale-[1.02]'
                          : 'text-neutral-300 hover:bg-neutral-800/50 hover:text-white hover:translate-x-1'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.badge && (
                        <span className="px-2 py-0.5 text-xs font-semibold bg-gradient-to-r from-neutral-900/40 to-red-900/30 text-red-100 border border-red-900/40 rounded-full">
                          {item.badge}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-neutral-800 bg-neutral-950/80 backdrop-blur-sm">
        <div className="text-xs text-neutral-400 space-y-1">
          <div className="flex items-center justify-between">
            <span>System Status</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-400 font-medium">Online</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
