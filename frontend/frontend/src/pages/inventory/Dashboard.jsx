import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
  Package, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCcw, 
  Search, 
  Filter, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Activity, 
  ChevronRight, 
  Calendar,
  Zap,
  ShieldCheck,
  TrendingDown,
  Brain
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { apiGet, apiPost } from '../../utils/api';
import { formatCurrency } from '../../utils/currency';
import { useNavigate } from 'react-router-dom';

export default function InventoryDashboard() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState('30d');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [inventoryDashboard, setInventoryDashboard] = useState(null);
  const [forecastChart, setForecastChart] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [replenishingIds, setReplenishingIds] = useState({});
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [openProcurementProductIds, setOpenProcurementProductIds] = useState(new Set());

  const reorderSuggestions = useMemo(() => {
    const recByProduct = new Map(
      (aiRecommendations || []).map((rec) => [Number(rec.product_id), rec])
    );

    return inventory
      .filter(item => {
        const productId = Number(item.product_id || item.id);
        if (openProcurementProductIds.has(productId)) return false;
        const avail = item.available_stock ?? item.current_stock ?? 0;
        const reorder = item.reorder_point || 100;
        return avail <= reorder;
      })
      .slice(0, 4)
      .map(item => {
        const productId = Number(item.product_id || item.id);
        const rec = recByProduct.get(productId);
        const avail = item.available_stock ?? item.current_stock ?? 0;
        const safety = item.safety_stock || 0;
        const aiQty = Number(rec?.effective_order_quantity ?? rec?.optimal_order_quantity ?? 0);
        const fallbackQty = Math.max(50, (item.reorder_point || 100) * 2 - avail);
        const suggestedQty = aiQty > 0 ? Math.max(1, aiQty) : fallbackQty;
        return {
          ...item,
          current: avail,
          suggestedQty,
          aiSuggested: aiQty > 0,
          priority: avail <= safety ? 'critical' : 'medium',
          reason: rec?.reasoning || (avail <= safety ? 'Below Safety Stock: Immediate stockout risk.' : 'Below Reorder Point: Replenishment advised.')
        };
      });
  }, [inventory, aiRecommendations, openProcurementProductIds]);

  const handleAutoReplenish = async (item) => {
    setReplenishingIds(prev => ({ ...prev, [item.id]: true }));
    try {
      const productId = item.product_id || item.id;
      const quantity = item.suggestedQty;
      const unitCost = item.unit_cost || 10;

      await apiPost('/api/procurement', {
        product_id: productId,
        supplier_name: 'Kinglion Rwanda Main Supplier',
        quantity,
        unit_cost: unitCost,
        expected_delivery: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: `Quick PO from Inventory Dashboard: ${item.reason}`
      });

      window.dispatchEvent(new Event('app:operations-data-updated'));
      window.dispatchEvent(new Event('app:notifications-changed'));
      window.dispatchEvent(new CustomEvent('app:toast', { 
        detail: { 
          type: 'success', 
          title: 'Order Sent to Operations', 
          description: `Quick PO for ${quantity} units of ${item.product_name || item.name} is pending Operations approval. Stock will update when goods are received.` 
        } 
      }));
      
      fetchDashboardData();
    } catch (e) {
      console.error(e);
      window.dispatchEvent(new CustomEvent('app:toast', { 
        detail: { type: 'error', title: 'Replenishment Failed', description: e.message || 'Could not place restock order.' } 
      }));
    } finally {
      setReplenishingIds(prev => ({ ...prev, [item.id]: false }));
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [inventoryData, alertsData, dashboardInventory, forecastData, auditData, recsData, procurementData] = await Promise.all([
        apiGet('/api/inventory').catch(() => ({ inventory: [] })),
        apiGet('/api/inventory/alerts?severity=high').catch(() => ({ alerts: [] })),
        apiGet('/api/dashboard/inventory').catch(() => null),
        apiGet('/api/dashboard/forecast-chart?days=90').catch(() => ({ chartData: [] })),
        apiGet('/api/audit?limit=10&entity_type=inventory').catch(() => ({ logs: [] })),
        apiGet('/api/forecast/recommendations').catch(() => ({ recommendations: [] })),
        apiGet('/api/procurement').catch(() => [])
      ]);

      const openPoProductIds = new Set(
        (Array.isArray(procurementData) ? procurementData : procurementData?.data || [])
          .filter((o) => !['cancelled'].includes(String(o.status || '').toLowerCase()))
          .map((o) => Number(o.product_id))
      );
      setOpenProcurementProductIds(openPoProductIds);

      setInventory(inventoryData.inventory || []);
      setAiRecommendations(recsData?.recommendations || []);
      setAlerts(alertsData.alerts || []);
      setInventoryDashboard(dashboardInventory || null);
      setForecastChart(forecastData.chartData || []);
      
      const logs = Array.isArray(auditData) ? auditData : (auditData?.logs || []);
      setRecentActivity(logs.map(log => ({
        id: log.id,
        type: log.action.toLowerCase(),
        title: log.action.replace(/_/g, ' '),
        description: `${log.details?.product_name || 'Item'} updated by ${log.user_name || 'System'}`,
        time: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        icon: log.action.includes('ADJUST') ? AlertTriangle : Package,
        color: log.action.includes('ADJUST') ? 'text-amber-500' : 'text-blue-500'
      })));
    } catch (error) {
      console.error('Failed to fetch inventory data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
    setTimeout(() => setRefreshing(false), 1500);
  };


  // Card values from backend (dashboard/inventory) when available, else from local inventory
  const backendValue = inventoryDashboard?.stockValue ?? null;
  const backendTurnover = inventoryDashboard?.turnoverRate ?? null;
  const backendForecastAccuracy = inventoryDashboard?.forecastAccuracy ?? null;
  const backendForecastErrorStats = inventoryDashboard?.forecastErrorStats;
  const abcSummary = inventoryDashboard?.abcSummary;
  const metrics = {
    totalItems: inventoryDashboard?.totalProducts ?? inventory.length,
    totalValue: backendValue != null ? backendValue : inventory.reduce((sum, item) => sum + ((item.available_stock ?? item.current_stock ?? 0) * (item.unit_cost || 0)), 0),
    lowStockItems: inventoryDashboard?.lowStockCount ?? inventory.filter(item => item.status === 'shortage' || (item.available_stock ?? item.current_stock ?? 0) <= (item.safety_stock || 0)).length,
    criticalItems: inventory.filter(item => item.status === 'shortage').length,
    overstockItems: inventoryDashboard?.overstockCount ?? inventory.filter(item => item.status === 'overstock').length,
    turnoverRate: backendTurnover != null ? backendTurnover : 0,
    accuracy: backendForecastAccuracy != null ? backendForecastAccuracy : 0,
    forecastMAE: backendForecastErrorStats?.mae ?? 0,
    forecastRMSE: backendForecastErrorStats?.rmse ?? 0,
    forecastMAPE: backendForecastErrorStats?.mape ?? 0,
    aCategoryCount: abcSummary?.a_count ?? 0,
    bCategoryCount: abcSummary?.b_count ?? 0,
    cCategoryCount: abcSummary?.c_count ?? 0,
    stockFlow: inventoryDashboard?.stockFlow ?? { stock_in: 0, stock_out: 0, sold: 0, ordered: 0 },
    productsWithForecast: inventoryDashboard?.productsWithForecast ?? 0,
    totalForecastedDemand: inventoryDashboard?.totalForecastedDemand ?? 0
  };

  // Stock health from real status: normal, shortage, overstock; Low = below reorder, above safety
  const lowCount = inventory.filter(item => {
    const avail = item.available_stock ?? item.current_stock ?? 0;
    const safety = item.safety_stock || 0;
    const reorder = item.reorder_point || 100;
    return avail > safety && avail < reorder;
  }).length;
  const revenueLoss = inventoryDashboard?.potentialStockoutLoss != null
    ? Number(inventoryDashboard.potentialStockoutLoss)
    : inventory
      .filter(item => (item.available_stock ?? item.current_stock ?? 0) <= (item.safety_stock || 0))
      .reduce((acc, item) => {
        const avail = item.available_stock ?? item.current_stock ?? 0;
        const shortage = Math.max(0, (item.safety_stock || 0) - avail);
        return acc + (shortage * (item.unit_price || 0));
      }, 0);

  const logisticsHealthPercent = inventoryDashboard?.stockHealthPercent != null
    ? Number(inventoryDashboard.stockHealthPercent)
    : inventory.length > 0
      ? Math.round((inventory.filter(item => item.status === 'normal').length / inventory.length) * 100)
      : 0;

  const stats = [
    { label: 'Total Items', value: metrics.totalItems, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Inventory Value', value: formatCurrency(metrics.totalValue), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Revenue at Risk', value: formatCurrency(revenueLoss), icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', sub: 'Potential stockout loss' },
    { label: 'Turnover Rate', value: `${metrics.turnoverRate}x`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Forecast MAE', value: `${metrics.forecastMAE}`, icon: TrendingDown, color: 'text-sky-600', bg: 'bg-sky-50', sub: 'Average error' },
    { label: 'ABC Category A', value: `${metrics.aCategoryCount} SKUs`, icon: BarChart3, color: 'text-indigo-600', bg: 'bg-indigo-50', sub: 'Top 70% value' }
  ];
  const stockHealth = [
    { category: 'Optimal', count: inventory.filter(item => item.status === 'normal').length, percentage: inventory.length > 0 ? (inventory.filter(item => item.status === 'normal').length / inventory.length) * 100 : 0, change: 0, color: '#10b981' },
    { category: 'Good', count: 0, percentage: 0, change: 0, color: '#3b82f6' },
    { category: 'Low', count: lowCount, percentage: inventory.length > 0 ? (lowCount / inventory.length) * 100 : 0, change: 0, color: '#f59e0b' },
    { category: 'Critical', count: metrics.criticalItems, percentage: inventory.length > 0 ? (metrics.criticalItems / inventory.length) * 100 : 0, change: 0, color: '#ef4444' }
  ];

  // Critical items from alerts
  const criticalItems = alerts.slice(0, 5).map(alert => ({
    id: alert.id,
    name: alert.product_name || 'Product',
    sku: alert.product_id ? `SKU-${alert.product_id}` : 'N/A',
    current: 0,
    reorder: 100,
    min: 50,
    status: alert.severity === 'critical' ? 'critical' : 'low',
    daysToStockout: 2,
    value: 0,
    location: 'Warehouse A',
    supplier: 'Supplier X',
    message: alert.message
  }));

  // Categories from actual inventory (Excel upload / products)
  const categoryValueMap = inventory.reduce((acc, item) => {
    const cat = item.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = { items: 0, value: 0 };
    const stock = item.available_stock ?? item.current_stock ?? 0;
    acc[cat].items += 1;
    acc[cat].value += stock * (item.unit_cost || 0);
    return acc;
  }, {});
  const categoryPerformance = Object.entries(categoryValueMap).map(([category, { items, value }]) => {
    const pct = inventory.length > 0 ? Math.round((items / inventory.length) * 100) : 0;
    return { category, items, value, turnover: metrics.turnoverRate || 0, stockHealth: Math.min(100, 50 + pct) };
  }).sort((a, b) => b.value - a.value);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
  const warehouseData = categoryPerformance.slice(0, 8).map((cat, i) => ({
    name: cat.category,
    items: cat.items,
    value: cat.value,
    utilization: inventory.length > 0 ? Math.round((cat.items / inventory.length) * 100) : 0,
    color: COLORS[i % COLORS.length]
  }));

  const stockLevelChartData = stockHealth.map((item) => ({
    name: item.category,
    items: item.count || 0.1 // Small value for visual "ghost" bars if 0
  }));

  const forecastTrendData = forecastChart
    .slice(0, 60)
    .map((row) => ({
      date: row.date ? new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-',
      demand: Math.round(Number(row.forecasted_demand) || 0)
    }));


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading inventory dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Inventory Dashboard</h1>
          <p className="text-muted-foreground">Real-time stock monitoring and optimization</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 px-4 py-2 rounded-xl border border-emerald-500/20 shadow-sm">
             <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
             <div className="flex flex-col">
               <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-tight">Logistics Network</span>
               <div className="flex items-center gap-2">
                 <div className="h-1.5 w-24 bg-gray-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                   <div
                     className={`h-full transition-all duration-500 ${
                       logisticsHealthPercent >= 75
                         ? 'bg-gradient-to-r from-emerald-500 to-blue-500'
                         : logisticsHealthPercent >= 50
                           ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                           : 'bg-gradient-to-r from-red-500 to-rose-500'
                     }`}
                     style={{ width: `${Math.max(8, logisticsHealthPercent)}%` }}
                   />
                 </div>
                 <span className={`text-[10px] font-bold ${
                   logisticsHealthPercent >= 75 ? 'text-emerald-700' : logisticsHealthPercent >= 50 ? 'text-amber-700' : 'text-red-700'
                 }`}>
                   {logisticsHealthPercent >= 75 ? 'Healthy' : logisticsHealthPercent >= 50 ? 'Constrained' : 'At Risk'}
                 </span>
               </div>
             </div>
          </div>
          
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="bg-white dark:bg-neutral-900 shadow-sm border-neutral-200">
            <RefreshCcw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <div className="p-2 rounded-lg bg-blue-50">
              <Package className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalItems.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all categories</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <div className="p-2 rounded-lg bg-green-50">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Current valuation (from inventory)</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Turnover Rate</CardTitle>
            <div className="p-2 rounded-lg bg-purple-50">
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.turnoverRate}x</div>
            <p className="text-xs text-muted-foreground mt-1">Average inventory turns (30d)</p>
            {metrics.productsWithForecast > 0 && (
              <div className="flex items-center gap-1 text-sm text-blue-600 mt-2">
                <TrendingUp className="w-4 h-4" />
                <span>Forecast linked ({metrics.productsWithForecast} products)</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-red-100 bg-red-50/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-red-700 uppercase tracking-tight">Critical Risk</CardTitle>
            <div className="p-2 rounded-lg bg-red-100">
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-red-600">{formatCurrency(revenueLoss)}</div>
            <p className="text-[10px] text-red-600/70 mt-1 font-bold uppercase">Potential Stockout Loss</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Forecast MAE</CardTitle>
            <div className="p-2 rounded-lg bg-sky-50">
              <TrendingDown className="h-4 w-4 text-sky-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.forecastMAE}</div>
            <p className="text-xs text-muted-foreground mt-1">Mean absolute forecast error</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Flow (30d)</CardTitle>
            <div className="p-2 rounded-lg bg-sky-50">
              <Activity className="h-4 w-4 text-sky-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span>In</span><span className="font-bold text-green-600">+{metrics.stockFlow.stock_in}</span></div>
              <div className="flex justify-between"><span>Out</span><span className="font-bold text-red-600">-{metrics.stockFlow.stock_out}</span></div>
              <div className="flex justify-between"><span>Sold</span><span className="font-bold">{metrics.stockFlow.sold}</span></div>
              <div className="flex justify-between"><span>Ordered</span><span className="font-bold">{metrics.stockFlow.ordered}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ABC Class A</CardTitle>
            <div className="p-2 rounded-lg bg-indigo-50">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.aCategoryCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Top 70% inventory value SKUs</p>
          </CardContent>
        </Card>
      </div>

      {inventoryDashboard?.forecastRecommendation && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 shadow-sm">
          <span className="font-semibold">Forecast Insight:</span> {inventoryDashboard.forecastRecommendation}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-md border-neutral-200 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Strategic Risk Analysis
            </CardTitle>
            <CardDescription className="text-[11px]">AI-powered shortage impact modeling</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-100">
               <div className="flex justify-between items-center mb-2">
                 <span className="text-[10px] font-bold text-neutral-500">CRITICAL SHORTAGES</span>
                 <span className="text-[10px] font-black px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                   {inventory.filter(i => i.available_stock <= 0).length} ITEMS
                 </span>
               </div>
               <p className="text-[11px] text-neutral-600 leading-relaxed">
                 AI Warning: Current stockout levels for motorcycles could result in a 
                 <span className="font-bold text-red-600 ml-1">
                   {Math.round((revenueLoss / (metrics.totalValue || 1)) * 100) || 4.2}%
                 </span> dip in quarterly targets.
               </p>
             </div>
             
             <div className="space-y-3">
               <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400">
                 <Zap className="w-3 h-3 text-amber-500" /> RECOMMENDED MITIGATION
               </div>
               <div className="flex items-center gap-3 p-2 hover:bg-neutral-50 rounded-lg cursor-pointer transition-colors group border border-dashed border-emerald-200">
                 <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                   <ArrowUpRight className="w-4 h-4" />
                 </div>
                 <div className="flex-1">
                   <p className="text-[11px] font-bold">Fast-Track Spare Parts PO</p>
                   <p className="text-[10px] text-muted-foreground">Est. Save: {formatCurrency(Math.min(revenueLoss, 1200000))}</p>
                 </div>
               </div>
             </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-md border-neutral-200 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Brain className="w-4 h-4 text-emerald-500" />
                AI Smart Replenishment Autopilot
              </CardTitle>
              <CardDescription className="text-[11px]">Proactive stockout prevention recommendations</CardDescription>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 text-[10px] font-bold border border-emerald-500/20">
              Closed-Loop Execution
            </Badge>
          </CardHeader>
          <CardContent>
            {reorderSuggestions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-100 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      <th className="pb-2 font-semibold">Product</th>
                      <th className="pb-2 text-center font-semibold">Stock</th>
                      <th className="pb-2 text-center font-semibold">Reorder Pt</th>
                      <th className="pb-2 text-center font-semibold">AI Suggested Restock</th>
                      <th className="pb-2 font-semibold">Priority & Recommendation</th>
                      <th className="pb-2 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {reorderSuggestions.map((item) => (
                      <tr key={item.id} className="text-xs hover:bg-neutral-50/50 transition-colors">
                        <td className="py-2.5">
                          <div className="font-semibold text-neutral-800 dark:text-neutral-200">{item.product_name || item.name}</div>
                          <div className="text-[10px] text-neutral-400 font-mono">{item.sku}</div>
                        </td>
                        <td className="py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300">
                          {item.current}
                        </td>
                        <td className="py-2.5 text-center text-neutral-400">
                          {item.reorder_point || 100}
                        </td>
                        <td className="py-2.5 text-center font-extrabold text-sm text-emerald-600">
                          {item.suggestedQty}
                        </td>
                        <td className="py-2.5">
                          <div className="flex flex-col gap-0.5 max-w-[200px]">
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${
                              item.priority === 'critical' ? 'text-red-500' : 'text-amber-500'
                            }`}>
                              {item.priority}
                            </span>
                            <span className="text-[10px] text-neutral-500 leading-tight italic truncate animate-pulse" title={item.reason}>
                              "{item.reason}"
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right">
                          <Button
                            size="sm"
                            disabled={Boolean(replenishingIds[item.id])}
                            onClick={() => handleAutoReplenish(item)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] h-7 px-3 py-0 shadow-sm"
                          >
                            {replenishingIds[item.id] ? 'Drafting...' : 'Quick PO'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-neutral-500 text-xs">
                <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                All stock levels are perfectly balanced above reorder thresholds!
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts">Critical Alerts</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Stock Health Distribution</CardTitle>
                <CardDescription>Current inventory status breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {inventory.length > 0 ? stockHealth.map((item, index) => (
                    <div key={index} className="space-y-2 group">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full transition-transform group-hover:scale-150"
                            style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}40` }}
                          />
                          <span className="font-semibold">{item.category}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{item.count} items</span>
                          <span className={`text-xs font-medium ${
                            item.percentage > 0 ? 'text-green-600' : 'text-gray-400'
                          }`}>
                            {Math.round(item.percentage)}%
                          </span>
                        </div>
                      </div>
                      <div className="relative w-full bg-gray-100 dark:bg-neutral-800 rounded-full h-3 overflow-hidden shadow-inner">
                        <div 
                          className="h-full rounded-full transition-all duration-1000 ease-out relative"
                          style={{ 
                            backgroundColor: item.color,
                            width: `${item.percentage || 2}%`,
                            opacity: item.percentage > 0 ? 1 : 0.2
                          }}
                        >
                          {item.percentage > 0 && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                          )}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="py-10 text-center space-y-3">
                       <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto opacity-50">
                         <Package className="w-8 h-8 text-gray-400" />
                       </div>
                       <p className="text-sm text-gray-500">Awaiting inventory data...</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By Category</CardTitle>
                <CardDescription>Inventory value by category (from your data)</CardDescription>
              </CardHeader>
              <CardContent>
                {warehouseData.length > 0 ? (
                  <>
                    <div className="h-[200px] w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <PieChart>
                          <Pie
                            data={warehouseData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {warehouseData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 mt-4">
                      {warehouseData.map((warehouse, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: warehouse.color }}
                            />
                            <span className="font-medium">{warehouse.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground">{warehouse.items} items</span>
                            <Badge variant="outline">{warehouse.utilization}% util.</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                    No category data yet. Add products/stock to render this chart.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Stock Level Trends</CardTitle>
                <CardDescription>Current stock health by status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  {inventory.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stockLevelChartData}>
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                        <Tooltip 
                          cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="items" fill="url(#barGradient)" name="Items" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-10 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-800">
                      <BarChart3 className="w-12 h-12 text-neutral-300 mb-4" />
                      <h4 className="font-bold text-neutral-400">Ready to visualize stock levels</h4>
                      <p className="text-xs text-neutral-400 mt-1 max-w-[200px]">Stock trends will appear here once you begin adding inventory records.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Forecast Demand Trend</CardTitle>
                <CardDescription>Demand prediction data from forecasting</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  {forecastTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={forecastTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="demand" stroke="#8b5cf6" strokeWidth={2} name="Forecasted Demand" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                      No forecast data yet. Generate forecast to show this chart.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Critical Stock Alerts
                  </CardTitle>
                  <CardDescription>Items requiring immediate action</CardDescription>
                </div>
                <Badge variant="destructive" className="text-lg px-4 py-1">
                  {criticalItems.filter(i => i.status === 'critical').length} Critical
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {criticalItems.length > 0 ? criticalItems.map((item) => (
                  <Card key={item.id} className={`border-l-4 ${
                    item.status === 'critical' ? 'border-l-red-500 bg-red-50' : 'border-l-yellow-500 bg-yellow-50'
                  }`}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <h4 className="font-semibold text-lg">{item.name}</h4>
                            <Badge variant={item.status === 'critical' ? 'destructive' : 'secondary'}>
                              {item.status === 'critical' ? 'CRITICAL' : 'LOW STOCK'}
                            </Badge>
                            <Badge variant="outline" className="font-mono">{item.sku}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{item.message}</p>
                        </div>
                        <div></div>
                      </div>
                    </CardContent>
                  </Card>
                )) : (
                  <p className="text-center text-muted-foreground py-8">No critical alerts at this time</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card className="border-0 shadow-xl overflow-hidden group">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-white dark:from-neutral-800 dark:to-neutral-900 border-b">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                Stock Health Heatmap
              </CardTitle>
              <CardDescription>Visual risk assessment across all product categories</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {categoryPerformance.map((cat, i) => (
                  <div 
                    key={i} 
                    className={`p-6 rounded-2xl border flex flex-col items-center justify-center text-center transition-all hover:scale-105 cursor-pointer shadow-sm hover:shadow-md ${
                      cat.stockHealth > 80 ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/10 dark:border-emerald-800' :
                      cat.stockHealth > 50 ? 'bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-900/10 dark:border-blue-800' :
                      'bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-900/10 dark:border-amber-800'
                    }`}
                  >
                    <span className="text-xs font-bold uppercase truncate w-full tracking-wider opacity-60 mb-2">{cat.category}</span>
                    <span className="text-3xl font-black">{cat.stockHealth}%</span>
                    <div className="mt-3 flex flex-col items-center">
                       <span className="text-[10px] font-bold">Turnover: {cat.turnover}x</span>
                       <span className="text-[10px] opacity-60">Value: {formatCurrency(cat.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-6 border-t flex items-center justify-center gap-8 text-xs text-gray-400 font-bold uppercase tracking-widest">
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div> Critical
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div> At Risk
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div> Healthy
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div> Optimal
                 </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest inventory movements and updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => {
                  const Icon = activity.icon;
                  return (
                    <div key={activity.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors dark:border-neutral-700">
                      <div className={`p-2 rounded-lg bg-gray-50 dark:bg-neutral-800`}>
                        <Icon className={`h-5 w-5 ${activity.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium">{activity.title}</h4>
                          <span className="text-sm text-muted-foreground">{activity.time}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{activity.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
