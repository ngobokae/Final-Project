import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Brain, Sparkles, TrendingUp, AlertTriangle, 
  ChevronRight, X, MessageSquare, Zap, ShieldCheck,
  Target, BarChart3, Package
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

import { useNavigate } from 'react-router-dom';

export default function AISidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    // Generate role-specific insights with actionable routes
    const generateInsights = () => {
      const role = user?.role;
      let roleInsights = [];

      if (role === 'executive') {
        roleInsights = [
          { icon: TrendingUp, title: 'Growth Opportunity', text: 'Regional sales in roofing sheets are up 15%. Recommend reallocating marketing spend.', type: 'positive', route: '/executive/ai-hub' },
          { icon: ShieldCheck, title: 'Risk Mitigation', text: 'Global supply chain volatility index increased. Consider 10% higher buffer stocks.', type: 'warning', route: '/executive/simulator' },
          { icon: Target, title: 'Strategic Goal', text: 'On track to meet Q1 revenue target of 120M RWF. Current progress: 88%.', type: 'info', route: '/executive/dashboard' }
        ];
      } else if (role === 'inventory') {
        roleInsights = [
          { icon: Package, title: 'Stock Health', text: 'Iron Sheets are reaching overstock levels. Suggest a promotional discount to clear space.', type: 'warning', route: '/inventory/dashboard' },
          { icon: AlertTriangle, title: 'Shortage Warning', text: 'Motorcycle parts will stock out in 4 days at current velocity. Immediate reorder required.', type: 'critical', route: '/inventory/alerts' },
          { icon: Zap, title: 'Efficiency Boost', text: 'AI optimized warehouse pathing can reduce picking time by 12% today.', type: 'positive', route: '/inventory/stock-overview' }
        ];
      } else if (role === 'operations') {
        roleInsights = [
          { icon: BarChart3, title: 'Production Sync', text: 'Demand for Cement Board exceeds production capacity. AI suggest shift overtime.', type: 'warning', route: '/operations/production-plan' },
          { icon: MessageSquare, title: 'Supplier Update', text: 'Vendor "Rwanda Metals" lead time increased by 2 days. Update procurement plans.', type: 'info', route: '/operations/procurement-plan' },
          { icon: Sparkles, title: 'Forecast Update', text: 'AI Forecast updated for Solar Products. Demand projected to peak in 10 days.', type: 'positive', route: '/operations/demand-forecast' }
        ];
      } else {
        roleInsights = [
          { icon: ShieldCheck, title: 'System Healthy', text: 'AI Models are operating at 95% accuracy. No anomalies detected.', type: 'positive', route: '/admin/dashboard' },
          { icon: AlertTriangle, title: 'Audit Alert', text: '3 high-value transactions flagged for verification.', type: 'warning', route: '/admin/audit-logs' }
        ];
      }
      setInsights(roleInsights);
    };

    generateInsights();
  }, [user]);

  const handleAction = (route) => {
    if (route) {
      navigate(route);
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Floating Trigger */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-2xl shadow-2xl hover:scale-110 transition-all duration-300 group animate-neural-pulse"
        >
          <div className="relative">
            <Brain className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
          </div>
          <span className="absolute right-full mr-3 bg-gray-900 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-bold">
            Kinglion AI Link
          </span>
        </button>
      )}

      {/* Sidebar Panel */}
      <div className={`fixed top-0 right-0 h-screen w-80 bg-white dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800 shadow-2xl z-[60] transition-transform duration-500 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-gray-100 dark:border-neutral-800 bg-gradient-to-r from-red-50 to-white dark:from-neutral-800 dark:to-neutral-900">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-red-600">
                <Brain className="w-6 h-6" />
                <h2 className="font-bold">Kinglion AI</h2>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Strategic Recommendations</p>
          </div>

          {/* Insights List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {insights.map((insight, idx) => {
              const Icon = insight.icon;
              return (
                <div key={idx} className="group p-4 rounded-2xl border border-gray-100 dark:border-neutral-800 hover:border-red-100 dark:hover:border-red-900/30 hover:bg-red-50/30 dark:hover:bg-red-900/5 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-xl ${
                      insight.type === 'positive' ? 'bg-emerald-100 text-emerald-600' :
                      insight.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                      insight.type === 'critical' ? 'bg-red-100 text-red-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{insight.title}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {insight.text}
                  </p>
                  <button 
                    onClick={() => handleAction(insight.route)}
                    className="mt-3 text-xs font-bold text-red-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Take Action <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 dark:border-neutral-800">
            <div className="p-4 bg-gray-900 text-white rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">System Accuracy</p>
                <p className="text-lg font-bold">95.2%</p>
              </div>
              <Zap className="w-8 h-8 text-yellow-400 fill-yellow-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[55] transition-opacity"
        />
      )}
    </>
  );
}
