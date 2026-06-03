import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Command, 
  Zap, 
  Box, 
  BarChart3, 
  Users, 
  Settings, 
  MessageSquare, 
  Brain, 
  LayoutDashboard, 
  Shield, 
  Activity, 
  ClipboardList, 
  ShoppingCart, 
  FileText, 
  PieChart, 
  Map, 
  QrCode, 
  UserCircle 
} from 'lucide-react';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const searchItems = [
    // Dashboards
    { title: 'Admin Dashboard', route: '/admin/dashboard', icon: LayoutDashboard, category: 'Dashboards' },
    { title: 'Operations Dashboard', route: '/operations/dashboard', icon: LayoutDashboard, category: 'Dashboards' },
    { title: 'Inventory Dashboard', route: '/inventory/dashboard', icon: LayoutDashboard, category: 'Dashboards' },
    { title: 'Executive Dashboard', route: '/executive/dashboard', icon: LayoutDashboard, category: 'Dashboards' },

    // Admin
    { title: 'User Management', route: '/admin/users', icon: Users, category: 'Admin' },
    { title: 'Permissions & Roles', route: '/admin/permissions', icon: Shield, category: 'Admin' },
    { title: 'System Settings', route: '/admin/system-settings', icon: Settings, category: 'Admin' },
    { title: 'AI Model Config', route: '/admin/ai-models', icon: Brain, category: 'Admin' },
    { title: 'Audit Logs', route: '/admin/audit-logs', icon: Activity, category: 'Admin' },

    // Operations
    { title: 'Demand Forecast', route: '/operations/demand-forecast', icon: Zap, category: 'Operations' },
    { title: 'Production Planning', route: '/operations/production-plan', icon: ClipboardList, category: 'Operations' },
    { title: 'Procurement Planning', route: '/operations/procurement-plan', icon: ShoppingCart, category: 'Operations' },

    // Inventory
    { title: 'Stock Overview', route: '/inventory/stock-overview', icon: Box, category: 'Inventory' },
    { title: 'Stock Transactions', route: '/inventory/stock-transactions', icon: Activity, category: 'Inventory' },
    { title: 'Inventory Optimization', route: '/inventory/optimization', icon: Zap, category: 'Inventory' },
    { title: 'Stock Alerts', route: '/inventory/alerts', icon: Zap, category: 'Inventory' },
    { title: 'Warehouse Map', route: '/inventory/warehouse-map', icon: Map, category: 'Inventory' },
    { title: 'QR Label Generator', route: '/inventory/labels', icon: QrCode, category: 'Inventory' },
    { title: 'Inventory Reports', route: '/inventory/reports', icon: FileText, category: 'Inventory' },

    // Executive
    { title: 'Key Performance Indicators', route: '/executive/kpis', icon: PieChart, category: 'Executive' },
    { title: 'Business Insights', route: '/executive/insights', icon: Brain, category: 'Executive' },
    { title: 'Executive Reports', route: '/executive/reports', icon: FileText, category: 'Executive' },
    { title: 'AI Strategic Hub', route: '/executive/ai-hub', icon: Zap, category: 'Executive' },
    { title: 'What-if Simulator', route: '/executive/simulator', icon: Brain, category: 'Executive' },

    // Shared
    { title: 'User Profile', route: '/shared/profile', icon: UserCircle, category: 'Shared' },
    { title: 'Message Center', route: '/shared/messages', icon: MessageSquare, category: 'Shared' }
  ];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  useEffect(() => {
    const filtered = searchItems.filter(item => 
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
    );
    setResults(filtered);
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (route) => {
    navigate(route);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex].route);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      <div 
        className="absolute inset-0 bg-neutral-950/40 backdrop-blur-md animate-in fade-in duration-300"
        onClick={() => setIsOpen(false)}
      />
      
      <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden animate-in slide-in-from-top-4 duration-300">
        <div className="flex items-center px-4 py-4 border-b border-gray-100 dark:border-neutral-800">
          <Search className="w-5 h-5 text-gray-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 text-lg placeholder-gray-400"
          />
          <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-neutral-800 rounded text-[10px] font-bold text-gray-400 uppercase">
            <Command className="w-3 h-3" /> K
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {results.length > 0 ? (
            <div className="space-y-1">
              {results.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelect(item.route)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                      idx === selectedIndex 
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-600' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${idx === selectedIndex ? 'bg-red-100' : 'bg-gray-100 dark:bg-neutral-800'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm">{item.title}</p>
                        <p className="text-[10px] opacity-60 uppercase tracking-widest">{item.category}</p>
                      </div>
                    </div>
                    {idx === selectedIndex && (
                      <div className="text-[10px] font-bold px-2 py-1 bg-white border border-red-100 rounded shadow-sm">ENTER</div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-gray-400 italic">No results for "{query}"</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 dark:bg-neutral-800/50 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
           <div className="flex gap-4">
             <span className="flex items-center gap-1"><span className="p-1 bg-white dark:bg-neutral-900 rounded border">↑↓</span> Navigate</span>
             <span className="flex items-center gap-1"><span className="p-1 bg-white dark:bg-neutral-900 rounded border">⏎</span> Select</span>
           </div>
           <span className="flex items-center gap-1 text-red-500"><Brain className="w-3 h-3" /> AI Enhanced Search</span>
        </div>
      </div>
    </div>
  );
}
