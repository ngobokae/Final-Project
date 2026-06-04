import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart3, Package, ArrowUpDown, Zap, AlertTriangle, FileText, ChevronRight, User, MessageSquare, Warehouse, QrCode } from 'lucide-react';
import logoSrc from '../../assets/IMG_1472.PNG';
import { apiGet } from '../../utils/api';

export default function InventorySidebar() {
  const [counts, setCounts] = useState({ stock: 0, alerts: 0 });

  useEffect(() => {
    let mounted = true;
    const loadCounts = async () => {
      try {
        const [inventoryRes, alertsRes] = await Promise.all([
          apiGet('/api/inventory').catch(() => ({ inventory: [] })),
          apiGet('/api/inventory/alerts?resolved=false').catch(() => ({ alerts: [] }))
        ]);
        const inventoryList = Array.isArray(inventoryRes)
          ? inventoryRes
          : inventoryRes?.inventory || inventoryRes?.data || [];
        const alertList = Array.isArray(alertsRes)
          ? alertsRes
          : alertsRes?.alerts || alertsRes?.data || [];
        if (!mounted) return;
        setCounts({
          stock: Array.isArray(inventoryList) ? inventoryList.length : 0,
          alerts: Array.isArray(alertList) ? alertList.length : 0
        });
      } catch {
        if (!mounted) return;
        setCounts({ stock: 0, alerts: 0 });
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
        { to: '/inventory/dashboard', icon: BarChart3, label: 'Dashboard', badge: null }
      ]
    },
    {
      title: 'Inventory Management',
      items: [
        { to: '/inventory/stock-overview', icon: Package, label: 'Stock Overview', badge: counts.stock > 0 ? String(counts.stock) : null },
        { to: '/inventory/stock-transactions', icon: ArrowUpDown, label: 'Logistics & Warehouse', badge: null },
        { to: '/inventory/warehouse-map', icon: Warehouse, label: 'Warehouse Map', badge: null },
        { to: '/inventory/labels', icon: QrCode, label: 'QR Labels', badge: null },
        { to: '/inventory/optimization', icon: Zap, label: 'Optimization', badge: null },
        { to: '/inventory/alerts', icon: AlertTriangle, label: 'Alerts', badge: counts.alerts > 0 ? String(counts.alerts) : null }
      ]
    },
    {
      title: 'Reports',
      items: [
        { to: '/inventory/reports', icon: FileText, label: 'Reports', badge: null }
      ]
    },
    {
      title: 'Account',
      items: [
        { to: '/inventory/profile', icon: User, label: 'Profile', badge: null },
        { to: '/inventory/messages', icon: MessageSquare, label: 'Messages', badge: null }
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
            <p className="text-xs text-neutral-300">Inventory</p>
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
                const hasAlert = item.badge && parseInt(item.badge) > 0;
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
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          hasAlert && item.to.includes('alerts')
                            ? 'bg-gradient-to-r from-neutral-900 to-red-800 text-white animate-pulse' 
                            : 'bg-neutral-700 text-neutral-200'
                        }`}>
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
            <span>Warehouse Status</span>
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
