import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart3, Upload, TrendingUp, Factory, Truck, FileText, ChevronRight, User, MessageSquare } from 'lucide-react';
import logoSrc from '../../assets/IMG_1472.PNG';
import { apiGet } from '../../utils/api';

export default function OperationsSidebar() {
  const [counts, setCounts] = useState({ production: 0, procurement: 0 });

  useEffect(() => {
    let mounted = true;
    const loadCounts = async () => {
      try {
        const [productionRes, procurementRes] = await Promise.all([
          apiGet('/api/production').catch(() => []),
          apiGet('/api/procurement').catch(() => [])
        ]);
        const productionList = Array.isArray(productionRes)
          ? productionRes
          : productionRes?.data || productionRes?.production_plans || [];
        const procurementList = Array.isArray(procurementRes)
          ? procurementRes
          : procurementRes?.data || procurementRes?.orders || [];

        const activeProduction = (Array.isArray(productionList) ? productionList : []).filter((p) => {
          const st = String(p?.status || '').toLowerCase();
          return st === 'scheduled' || st === 'in_progress' || st === 'delayed';
        }).length;

        const activeProcurement = (Array.isArray(procurementList) ? procurementList : []).filter((o) => {
          const st = String(o?.status || '').toLowerCase();
          return st === 'pending' || st === 'approved' || st === 'in_transit';
        }).length;

        if (!mounted) return;
        setCounts({ production: activeProduction, procurement: activeProcurement });
      } catch {
        if (!mounted) return;
        setCounts({ production: 0, procurement: 0 });
      }
    };

    loadCounts();
    
    // Listen for data updates and clear events
    const handleDataUpdate = () => {
      if (mounted) loadCounts();
    };
    
    window.addEventListener('app:operations-data-updated', handleDataUpdate);
    window.addEventListener('app:notifications-changed', handleDataUpdate);
    window.addEventListener('app:forecasts-updated', handleDataUpdate);
    
    return () => {
      mounted = false;
      window.removeEventListener('app:operations-data-updated', handleDataUpdate);
      window.removeEventListener('app:notifications-changed', handleDataUpdate);
      window.removeEventListener('app:forecasts-updated', handleDataUpdate);
    };
  }, []);

  const menuSections = [
    {
      title: 'Overview',
      items: [
        { to: '/operations/dashboard', icon: BarChart3, label: 'Dashboard', badge: null }
      ]
    },
    {
      title: 'Planning',
      items: [
        { to: '/operations/demand-forecast', icon: TrendingUp, label: 'Demand Forecast', badge: null },
        { to: '/operations/production-plan', icon: Factory, label: 'Production Plan', badge: counts.production > 0 ? String(counts.production) : null },
        { to: '/operations/procurement-plan', icon: Truck, label: 'Procurement Plan', badge: counts.procurement > 0 ? String(counts.procurement) : null }
      ]
    },
    {
      title: 'Reports',
      items: [
        { to: '/operations/reports', icon: FileText, label: 'Reports', badge: null }
      ]
    },
    {
      title: 'Account',
      items: [
        { to: '/operations/profile', icon: User, label: 'Profile', badge: null },
        { to: '/operations/messages', icon: MessageSquare, label: 'Messages', badge: null }
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
            <p className="text-xs text-neutral-300">Operations</p>
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
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          item.badge === 'New' 
                            ? 'bg-gradient-to-r from-neutral-900 to-red-800 text-white' 
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
            <span>Operations Status</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-400 font-medium">Active</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
