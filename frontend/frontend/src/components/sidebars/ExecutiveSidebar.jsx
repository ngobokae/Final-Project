import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart3, Target, Lightbulb, FileText, ChevronRight, User, MessageSquare, Brain, Loader2, Download, Calculator } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import logoSrc from '../../assets/IMG_1472.PNG';
import { apiGet } from '../../utils/api';
import { generateBusinessReport } from '../../utils/reportGenerator';

export default function ExecutiveSidebar() {
  const { user } = useAuth();
  const [insightsCount, setInsightsCount] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadInsightsCount = async () => {
      try {
        const insightsRes = await apiGet('/api/insights?active=true').catch(() => []);
        const insights = Array.isArray(insightsRes)
          ? insightsRes
          : insightsRes?.data || insightsRes?.insights || [];
        if (!mounted) return;
        setInsightsCount(Array.isArray(insights) ? insights.length : 0);
      } catch {
        if (!mounted) return;
        setInsightsCount(0);
      }
    };

    loadInsightsCount();
    window.addEventListener('app:operations-data-updated', loadInsightsCount);
    window.addEventListener('app:notifications-changed', loadInsightsCount);
    return () => {
      mounted = false;
      window.removeEventListener('app:operations-data-updated', loadInsightsCount);
      window.removeEventListener('app:notifications-changed', loadInsightsCount);
    };
  }, []);

  const handleQuickReport = async () => {
    setIsGenerating(true);
    try {
      const stats = await apiGet('/api/dashboard/stats');
      const insightsRes = await apiGet('/api/insights?active=true');
      const insights = Array.isArray(insightsRes) ? insightsRes : (insightsRes?.insights || []);
      
      await generateBusinessReport(user, stats, insights);
    } catch (error) {
      console.error('Report error:', error);
      alert(`Could not generate report: ${error.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const menuSections = [
    {
      title: 'Overview',
      items: [
        { to: '/executive/dashboard', icon: BarChart3, label: 'Dashboard', badge: null }
      ]
    },
    {
      title: 'Analytics',
      items: [
        { to: '/executive/kpis', icon: Target, label: 'KPIs', badge: null },
        { to: '/executive/insights', icon: Lightbulb, label: 'Insights', badge: insightsCount > 0 ? String(insightsCount) : null },
        { to: '/executive/ai-hub', icon: Brain, label: 'AI Hub', badge: 'Active' },
        { to: '/executive/simulator', icon: Calculator, label: 'Profit Simulator', badge: 'New' }
      ]
    },
    {
      title: 'Reports',
      items: [
        { to: '/executive/reports', icon: FileText, label: 'Reports', badge: null }
      ]
    },
    {
      title: 'Account',
      items: [
        { to: '/executive/profile', icon: User, label: 'Profile', badge: null },
        { to: '/executive/messages', icon: MessageSquare, label: 'Messages', badge: null }
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
            <p className="text-xs text-neutral-300">Executive</p>
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
                      `group flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 ${isActive
                        ? 'bg-gradient-to-r from-neutral-900 to-red-800 text-white shadow-lg shadow-black/20 scale-[1.02] font-semibold'
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
                        <span className="px-2 py-0.5 text-xs font-semibold bg-gradient-to-r from-neutral-900/50 to-red-900/30 text-red-100 rounded-full">
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

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-neutral-800 bg-neutral-950/80 backdrop-blur-sm space-y-3">
        <button
          onClick={handleQuickReport}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-700 hover:bg-red-600 active:scale-95 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-red-900/20 disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Generate PDF Report
        </button>

        <div className="text-xs text-neutral-400 space-y-1">
          <div className="flex items-center justify-between">
            <span>Executive Portal</span>
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
