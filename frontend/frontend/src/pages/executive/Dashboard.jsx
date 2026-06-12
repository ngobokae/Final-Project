import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
  TrendingUp, TrendingDown, DollarSign, Target, Package, AlertTriangle, 
  BarChart3, Users, ShoppingCart, Clock, ArrowUpRight, ArrowDownRight,
  Sparkles, RefreshCcw, Calendar, Eye, Zap, ShieldCheck, Calculator
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, RadialBarChart, RadialBar
} from 'recharts';
import { apiGet } from '../../utils/api';
import { formatCurrency } from '../../utils/currency';
import { getChartTheme, AreaGradient, getAxisProps, getGridProps, getTooltipProps } from '../../utils/chartStyles';
import { useNavigate } from 'react-router-dom';

export default function ExecutiveDashboard() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedMetric, setSelectedMetric] = useState('revenue');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [salesChart, setSalesChart] = useState([]);
  const [forecastChart, setForecastChart] = useState([]);
  const [categoryPerformance, setCategoryPerformance] = useState([]);
  const [regionalData, setRegionalData] = useState([]);
  const [healthMetrics, setHealthMetrics] = useState([]);
  const [kpiMetrics, setKpiMetrics] = useState([]);
  const [revenueProfitTrend, setRevenueProfitTrend] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [recentActivity, setRecentActivity] = useState([]);
  const [kpiComparison, setKpiComparison] = useState([]);
  const [simPriceChange, setSimPriceChange] = useState(0);
  const [simCostReduction, setSimCostReduction] = useState(0);

  const [strategicInsights, setStrategicInsights] = useState([]);
  const [strategicAlerts, setStrategicAlerts] = useState([]);

  const baseRevenue = stats?.netRevenue ?? stats?.totalRevenue ?? 0;
  const baseProfit = baseRevenue * 0.25;
  const simulatedProjections = {
    revenue: baseRevenue * (1 + simPriceChange / 100),
    profit: (baseRevenue * (1 + simPriceChange / 100) * 0.25) + (baseRevenue * (simCostReduction / 100))
  };
  const simProfitChange = baseProfit > 0 ? ((simulatedProjections.profit - baseProfit) / baseProfit) * 100 : 0;

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

  useEffect(() => {
    const onForecastsUpdated = () => fetchDashboardData();
    const onOperationsDataUpdated = () => fetchDashboardData();
    window.addEventListener('app:forecasts-updated', onForecastsUpdated);
    window.addEventListener('app:operations-data-updated', onOperationsDataUpdated);
    return () => {
      window.removeEventListener('app:forecasts-updated', onForecastsUpdated);
      window.removeEventListener('app:operations-data-updated', onOperationsDataUpdated);
    };
  }, []);

  useEffect(() => {
    const checkDarkMode = () => {
      setDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const getDaysFromRange = (range) => {
    const map = { '7d': 7, '30d': 30, '90d': 90, '1y': 365, '2y': 730, 'ytd': 365 };
    return map[range] || 30;
  };

  const handleKpiCardClick = (kpiId) => {
    const navigationMap = {
      'revenue': '/executive/kpis',
      'orders': '/executive/procurement-approvals',
      'accuracy': '/executive/kpis',
      'inventory': '/executive/kpis',
      'stockout': '/executive/kpis',
      'satisfaction': '/executive/kpis',
      'prediction_revenue': '/executive/insights'
    };
    
    const route = navigationMap[kpiId];
    if (route) {
      navigate(route);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const days = getDaysFromRange(timeRange);
      // Same data sources as Operations Dashboard: sales/stats, forecast, dashboard/stats, charts
      const [
        dashboardStats,
        salesStatsResp,
        forecastsResp,
        salesData,
        forecastData,
        categoryData,
        regionalDataRes,
        healthData,
        revenueProfitRes,
        insightsRes,
        alertsRes,
        auditData
      ] = await Promise.all([
        apiGet(`/api/dashboard/stats?days=${days}`).catch(() => ({ stats: {} })),
        apiGet(`/api/sales/stats?days=${Math.max(days, 365)}`).catch(() => ({ totalRevenue: 0, totalRecords: 0 })),
        apiGet('/api/forecast?days=365').catch(() => ({ forecasts: [] })),
        apiGet(`/api/dashboard/sales-chart?days=${days}`).catch(() => ({ chartData: [] })),
        apiGet(`/api/dashboard/forecast-chart?days=${days}`).catch(() => ({ chartData: [] })),
        apiGet(`/api/dashboard/category-performance?days=${days}`).catch(() => ({ performance: [] })),
        apiGet(`/api/dashboard/regional-data?days=${days}`).catch(() => ({ regionalData: [] })),
        apiGet(`/api/dashboard/health-metrics?days=${days}`).catch(() => ({ healthMetrics: [] })),
        apiGet(`/api/dashboard/revenue-profit-trend?days=${days}`).catch(() => ({ trend: [] })),
        apiGet('/api/insights?type=opportunity&dismissed=false').catch(() => ({})),
        apiGet('/api/inventory/alerts?severity=high').catch(() => ({ alerts: [] })),
        apiGet('/api/audit?limit=10').catch(() => ({ logs: [] }))
      ]);

      // Calculate Revenue at Risk (Cost of Inaction)
      const revenueAtRisk = (healthData?.healthMetrics || []).reduce((acc, curr) => {
        if (curr.status === 'out_of_stock' || curr.status === 'low_stock') {
          return acc + (curr.value * 0.15); // Estimated 15% of inventory value is at immediate risk
        }
        return acc;
      }, 0);

      setStats({
        ...dashboardStats.stats,
        netRevenue: Number(dashboardStats.stats?.net_revenue ?? dashboardStats.stats?.total_revenue ?? 0),
        totalRevenue: Number(dashboardStats.stats?.net_revenue ?? dashboardStats.stats?.total_revenue ?? 0),
        actualRevenue: Number(dashboardStats.stats?.actual_revenue ?? 0),
        predictionRevenue: Number(dashboardStats.stats?.prediction_revenue ?? dashboardStats.stats?.total_revenue_forecast ?? 0),
        procurementDeductions: Number(dashboardStats.stats?.procurement_deductions ?? 0),
        totalSales: salesStatsResp.totalRecords || 0,
        revenueAtRisk: revenueAtRisk || 0
      });

      const alertList = Array.isArray(alertsRes?.alerts) ? alertsRes.alerts : [];
      setStrategicAlerts(alertList.slice(0, 8));

      const insightsRaw = Array.isArray(insightsRes) ? insightsRes : (insightsRes?.data?.insights || insightsRes?.insights || []);
      const insights = (insightsRaw || []).slice(0, 5).map(insight => ({
        id: insight.id,
        title: insight.title,
        description: insight.description,
        impact: insight.priority === 'high' ? 'High' : insight.priority === 'medium' ? 'Medium' : 'Low',
        type: insight.insight_type === 'opportunity' ? 'opportunity' : 'efficiency',
        confidence: 88,
        actionItems: insight.recommended_action ? [insight.recommended_action] : [],
        potentialRevenue: 0,
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }));
      setStrategicInsights(insights);

      setSalesChart(salesData.chartData || []);
      setForecastChart(forecastData.chartData || []);
      setCategoryPerformance(categoryData.performance || []);
      setRegionalData(regionalDataRes.regionalData || []);
      setHealthMetrics(healthData.healthMetrics || []);

      // Net revenue from sold/stock-out transactions minus accepted procurement orders
      const revenueActual = Number(dashboardStats.stats?.actual_revenue ?? dashboardStats.stats?.transaction_revenue ?? 0);
      const revenueForecast = Number(dashboardStats.stats?.prediction_revenue ?? dashboardStats.stats?.total_revenue_forecast ?? 0);
      const revenue = Number(dashboardStats.stats?.net_revenue ?? dashboardStats.stats?.total_revenue ?? revenueActual);
      const orders = Number(salesStatsResp?.totalRecords ?? dashboardStats.stats?.total_sales ?? 0);

      const growthPct = Number(dashboardStats.stats?.sales_growth_pct ?? 0);
      const previousRevenue = growthPct !== 0 && revenue > 0
        ? revenue / (1 + growthPct / 100)
        : revenue * 0.92;
      const previousOrders = previousRevenue > 0 && revenue > 0
        ? Math.round(orders * (previousRevenue / revenue))
        : Math.round(orders * 0.92);

      const trendArray = revenueProfitRes?.trend || [];
      if (trendArray.length === 0 && (revenueActual > 0 || (salesData.chartData || []).length > 0)) {
        const fromChart = (salesData.chartData || []).slice(-14).map((row) => ({
          date: row.date,
          month: new Date(row.date).toLocaleDateString('en-US', { month: 'short' }),
          revenue: row.revenue || 0,
          profit: (row.revenue || 0) * 0.21,
          orders: row.sales_count || 0
        }));
        setRevenueProfitTrend(fromChart.length > 0 ? fromChart : [{
          date: new Date().toISOString().slice(0, 10),
          month: new Date().toLocaleDateString('en-US', { month: 'short' }),
          revenue: revenueActual,
          profit: revenueActual * 0.21,
          orders
        }]);
      } else {
        setRevenueProfitTrend(trendArray);
      }
      
      const logs = Array.isArray(auditData) ? auditData : (auditData?.logs || []);
      setRecentActivity(logs.filter(l => ['CREATE_ORDER', 'APPROVE_ORDER', 'SALE', 'LOGIN'].includes(l.action)).map(log => ({
        id: log.id,
        type: log.action.toLowerCase(),
        title: log.action.replace(/_/g, ' '),
        description: `${log.details?.product_name || log.details?.customer || 'Strategic event'} processed by ${log.user_name || 'Admin'}`,
        time: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        icon: log.action.includes('ORDER') ? ShoppingCart : log.action === 'SALE' ? DollarSign : Users,
        color: log.action.includes('APPROVE') ? 'text-emerald-500' : 'text-blue-500'
      })));

      // Forecast accuracy: from dashboard/stats, or from forecast list confidence (same as Operations)
      let accuracy = Number(dashboardStats.stats?.forecast_accuracy) ?? 0;
      if ((!accuracy || accuracy <= 0) && Array.isArray(forecastsResp?.forecasts) && forecastsResp.forecasts.length > 0) {
        const confidences = forecastsResp.forecasts
          .map((f) => {
            const raw = f.confidence_level;
            const n = typeof raw === 'number' ? raw : Number(raw);
            return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.95;
          })
          .filter(Boolean);
        if (confidences.length > 0) {
          accuracy = Math.round((confidences.reduce((s, c) => s + c, 0) / confidences.length) * 100);
        }
      }
      if (!accuracy && forecastData.chartData?.length > 0) accuracy = 95;

      const inventoryValue = Number(dashboardStats.stats?.inventory_value) || 0;
      const turnover = Number(dashboardStats.stats?.inventory_turnover) || (
        inventoryValue > 0 && revenueActual > 0 && days > 0
          ? (revenueActual / inventoryValue) * (365 / days)
          : 0
      );

      const lowStock = Number(dashboardStats.stats?.low_stock_items) || 0;
      const totalProducts = Math.max(1, Number(dashboardStats.stats?.total_products) || 1);
      const stockoutRate = totalProducts > 0 ? (lowStock / totalProducts) * 100 : 0;

      const trendSeries = revenueProfitRes?.trend || [];
      const revenueSpark = trendSeries.length > 0
        ? trendSeries.slice(-7).map(t => t.revenue_actual ?? t.revenue ?? 0)
        : (revenue > 0 ? [0, 0, 0, 0, 0, 0, revenue] : [0]);
      const ordersSpark = trendSeries.length > 0
        ? trendSeries.slice(-7).map(t => t.orders || 0)
        : (orders > 0 ? [0, 0, 0, 0, 0, 0, orders] : [0]);

      setKpiMetrics([
        {
          id: 'revenue',
          title: 'Total Revenue',
          value: revenue,
          change: previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue * 100) : 0,
          trend: revenue > previousRevenue ? 'up' : 'down',
          target: Math.max(revenue * 1.1, 1),
          icon: DollarSign,
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-950',
          sparkline: revenueSpark,
          subtitle: 'Sold/stock-out minus procurement (Excel upload does not count)'
        },
        {
          id: 'orders',
          title: 'Total Orders',
          value: orders,
          change: previousOrders > 0 ? ((orders - previousOrders) / previousOrders * 100) : 0,
          trend: orders > previousOrders ? 'up' : 'down',
          target: Math.max(orders * 1.2, 1),
          icon: ShoppingCart,
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-950',
          sparkline: ordersSpark
        },
        {
          id: 'accuracy',
          title: 'Forecast Accuracy',
          value: accuracy,
          change: 2.3,
          trend: 'up',
          target: 95,
          icon: Target,
          color: 'text-purple-600 dark:text-purple-400',
          bgColor: 'bg-purple-50 dark:bg-purple-950',
          sparkline: [89, 90, 91, 92, 93, 94, accuracy],
          suffix: '%'
        },
        {
          id: 'inventory',
          title: 'Inventory Turnover',
          value: turnover,
          change: 12.1,
          trend: 'up',
          target: 10,
          icon: Package,
          color: 'text-orange-600 dark:text-orange-400',
          bgColor: 'bg-orange-50 dark:bg-orange-950',
          sparkline: [6.2, 6.8, 7.2, 7.6, 8.0, 8.3, turnover],
          suffix: 'x'
        },
        {
          id: 'stockout',
          title: 'Stockout Rate',
          value: stockoutRate,
          change: -0.8,
          trend: 'down',
          target: 2.0,
          icon: AlertTriangle,
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-950',
          sparkline: [2.8, 2.4, 2.0, 1.8, 1.5, 1.3, stockoutRate],
          suffix: '%',
          inverse: true
        },
        {
          id: 'prediction_revenue',
          title: 'Prediction Revenue',
          value: revenueForecast,
          change: revenueForecast > 0 ? 8.2 : 0,
          trend: revenueForecast > 0 ? 'up' : 'down',
          target: Math.max(revenueForecast * 1.15, 1),
          icon: Sparkles,
          color: 'text-indigo-600 dark:text-indigo-400',
          bgColor: 'bg-indigo-50 dark:bg-indigo-950',
          sparkline: revenueForecast > 0 ? [0, revenueForecast * 0.7, revenueForecast * 0.85, revenueForecast] : [0],
          isCurrency: true,
          subtitle: 'Forecast demand × unit price (30d)'
        }
      ]);

      const compData = [
        { metric: 'Net Revenue', actual: revenue, forecast: revenueForecast, previous: previousRevenue },
        { metric: 'Actual Sales', actual: revenueActual, forecast: revenueActual, previous: previousRevenue },
        { metric: 'Orders', actual: orders, forecast: orders, previous: previousOrders },
        { metric: 'Forecast Accuracy', actual: accuracy, forecast: 95, previous: 0 }
      ];
      setKpiComparison(compData);
    } catch (error) {
      console.error('Failed to fetch executive dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
    setTimeout(() => setRefreshing(false), 1500);
  };

  const formatNumber = (value) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toLocaleString();
  };

  const revenueTrendData = revenueProfitTrend.length > 0
    ? revenueProfitTrend.map((row) => ({
        month: row.month || new Date(row.date).toLocaleDateString('en-US', { month: 'short' }),
        revenue: row.revenue_actual ?? row.revenue ?? 0,
        revenue_forecast: row.revenue_forecast || 0,
        profit: row.profit_actual ?? row.profit ?? 0,
        profit_forecast: row.profit_forecast || 0,
        orders: row.orders || 0
      }))
    : salesChart.map((item) => ({
        month: new Date(item.date).toLocaleDateString('en-US', { month: 'short' }),
        revenue: item.revenue || 0,
        profit: (item.revenue || 0) * 0.21,
        orders: item.sales_count || 0
      })).slice(-30);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading executive dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Executive Dashboard</h1>
          <p className="text-muted-foreground">Strategic overview and key business insights</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
              <SelectItem value="2y">Last 2 years</SelectItem>
              <SelectItem value="ytd">Year to date</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCcw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Strategic AI Marquee */}
      <div className="bg-neutral-900 text-white p-3 rounded-2xl flex items-center gap-6 overflow-hidden shadow-2xl relative mb-6">
        <div className="absolute left-0 top-0 bottom-0 w-2 bg-red-600 animate-pulse" />
        <div className="flex items-center gap-2 px-4 border-r border-neutral-700 shrink-0">
          <ShieldCheck className="w-5 h-5 text-red-500" />
          <span className="text-xs font-black uppercase tracking-widest text-red-500">Strategic Alert</span>
        </div>
        <div className="flex-1 overflow-hidden whitespace-nowrap">
           <div className="flex items-center gap-10 animate-marquee hover:pause-marquee">
              {(strategicAlerts.length > 0 ? strategicAlerts : strategicInsights).map((item, idx) => (
                <span key={item.id || idx} className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 ${item.severity === 'critical' ? 'text-red-500' : 'text-amber-500'}`} />
                  {(item.message || item.title || item.description || 'System alert').toString().slice(0, 120)}
                </span>
              ))}
              {strategicAlerts.length === 0 && strategicInsights.length === 0 && (
                <span className="text-sm opacity-90">No active alerts — inventory and operations are within normal thresholds.</span>
              )}
              <span className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-400" />
                Revenue at risk from stock imbalances: <span className="text-red-400 font-bold">{formatCurrency(stats?.revenueAtRisk || 0)}</span>
              </span>
           </div>
        </div>
      </div>

      {/* 6 KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpiMetrics.map((kpi) => {
          const Icon = kpi.icon;
          const isPositive = kpi.inverse ? kpi.change < 0 : kpi.change > 0;
          const progressNum = kpi.target > 0 ? (Number(kpi.value) / Number(kpi.target)) * 100 : 0;
          const progress = Number.isFinite(progressNum) ? Math.min(100, Math.round(progressNum)) : 0;

          return (
            <Card
              key={kpi.id}
              className="hover:shadow-lg transition-all cursor-pointer"
              onClick={() => handleKpiCardClick(kpi.id)}
            >
              <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                  {kpi.id === 'revenue' && (
                    <CardDescription>Sold/stock-out revenue minus accepted orders</CardDescription>
                  )}
                  {kpi.id === 'prediction_revenue' && (
                    <CardDescription>Forecast demand value (not actual sales)</CardDescription>
                  )}
                </div>
                <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                  <Icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Value and % change */}
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <div className="text-2xl font-bold">
                      {kpi.id === 'revenue' || kpi.isCurrency ? formatCurrency(kpi.value) : kpi.value.toLocaleString()}
                      {kpi.suffix || ''}
                    </div>
                    <div
                      className={`flex items-center text-sm font-medium ${
                        isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {isPositive ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      {Math.abs(kpi.change).toFixed(1)}%
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress to target</span>
                      <span>{Number.isFinite(progressNum) ? `${progress}%` : 'NaN%'}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-neutral-600 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          kpi.color.includes('blue') ? 'bg-blue-500 dark:bg-blue-400' :
                          kpi.color.includes('green') ? 'bg-green-500 dark:bg-green-400' :
                          kpi.color.includes('purple') ? 'bg-purple-500 dark:bg-purple-400' :
                          kpi.color.includes('orange') ? 'bg-orange-500 dark:bg-orange-400' :
                          kpi.color.includes('red') ? 'bg-red-500 dark:bg-red-400' :
                          kpi.color.includes('indigo') ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-gray-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Small sparkline */}
                <div className="h-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={kpi.sparkline.map((val) => ({ value: val }))}>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={document.documentElement.classList.contains('dark') ? '#94a3b8' : '#64748b'}
                        fill={document.documentElement.classList.contains('dark') ? '#94a3b8' : '#64748b'}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="performance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insights">Strategic Insights</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
          <TabsTrigger value="health">Business Health</TabsTrigger>
          <TabsTrigger value="simulator">Scenario Simulator</TabsTrigger>
          <TabsTrigger value="activity">Activity Feed</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                <CardTitle>Revenue & Profit Trends</CardTitle>
                <CardDescription>Actual sales (solid) vs prediction revenue (dashed). Kept separate — not combined.</CardDescription>
                </div>
                <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="profit">Profit</SelectItem>
                    <SelectItem value="orders">Orders</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] min-h-[300px] bg-background dark:bg-card rounded-lg p-4 flex justify-center items-center overflow-x-auto">
                {revenueTrendData.length > 0 ? (() => {
                  const chartTheme = getChartTheme();
                  const axisProps = getAxisProps();
                  const gridProps = getGridProps();
                  const tooltipProps = getTooltipProps();
                  return (
                    <AreaChart width={680} height={365} data={revenueTrendData}>
                      <defs>
                        <linearGradient id="areaGradient-revenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={chartTheme.areaFillStart} stopOpacity={0.8} />
                          <stop offset="100%" stopColor={chartTheme.areaFillEnd} stopOpacity={0.2} />
                        </linearGradient>
                        <linearGradient id="areaGradient-revenue-forecast" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8884d8" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#8884d8" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="month" {...axisProps} />
                      <YAxis
                        tickFormatter={(v) => (selectedMetric === 'orders' ? v : formatCurrency(v))}
                        {...axisProps}
                      />
                      <Tooltip
                        formatter={(value) => (selectedMetric === 'orders' ? value : formatCurrency(value))}
                        {...tooltipProps}
                      />
                      <Legend verticalAlign="top" height={36} />
                      {selectedMetric === 'revenue' ? (
                        <>
                          <Area
                            name="Actual Revenue"
                            type="monotone"
                            dataKey="revenue"
                            stroke={chartTheme.lineColor}
                            strokeWidth={2}
                            fill="url(#areaGradient-revenue)"
                            fillOpacity={chartTheme.areaFillOpacity}
                          />
                          <Area
                            name="Prediction Revenue"
                            type="monotone"
                            dataKey="revenue_forecast"
                            stroke="#8884d8"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            fill="url(#areaGradient-revenue-forecast)"
                            fillOpacity={0.25}
                          />
                        </>
                      ) : selectedMetric === 'profit' ? (
                        <>
                          <Area
                            name="Actual Profit"
                            type="monotone"
                            dataKey="profit"
                            stroke={chartTheme.lineColor}
                            strokeWidth={2}
                            fill="url(#areaGradient-revenue)"
                            fillOpacity={chartTheme.areaFillOpacity}
                          />
                          <Area
                            name="Prediction Profit"
                            type="monotone"
                            dataKey="profit_forecast"
                            stroke="#8884d8"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            fill="url(#areaGradient-revenue-forecast)"
                            fillOpacity={0.25}
                          />
                        </>
                      ) : (
                        <Area
                          type="monotone"
                          dataKey={selectedMetric}
                          stroke={chartTheme.lineColor}
                          strokeWidth={2}
                          fill="url(#areaGradient-revenue)"
                          fillOpacity={chartTheme.areaFillOpacity}
                        />
                      )}
                    </AreaChart>
                  );
                })() : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <BarChart3 className="w-14 h-14 mb-3 opacity-50" />
                    <p className="font-medium text-foreground">No revenue data in this period</p>
                    <p className="text-sm mt-1">Upload sales data (Sales → Upload) or choose a different date range. Data is shown for the selected &quot;Last 7/30/90 days&quot; or &quot;Last year&quot;.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Category Performance</CardTitle>
                <CardDescription>Actual sales revenue by category (prediction shown separately)</CardDescription>
              </CardHeader>
              <CardContent>
                  <div className="space-y-4">
                  {categoryPerformance.length > 0 ? categoryPerformance.map((category, index) => {
                    const actualRev = Number(category.revenue) || 0;
                    const forecastRev = Number(category.forecast_revenue) || 0;
                    const target = category.target || actualRev * 1.1;
                    const performance = target > 0 ? Math.min(100, Math.round((actualRev / target) * 100)) : 0;
                    const isAboveTarget = actualRev >= target;

                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{category.category}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${
                              category.growth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                              {category.growth >= 0 ? '+' : ''}{category.growth}%
                            </span>
                            <span className="text-muted-foreground">
                              {formatCurrency(actualRev)}
                              {forecastRev > 0 && (
                                <span className="text-xs ml-1 text-indigo-600 dark:text-indigo-400">
                                  (pred. {formatCurrency(forecastRev)})
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="relative w-full bg-gray-200 dark:bg-neutral-600 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              isAboveTarget ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${performance}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Target: {formatCurrency(target)}</span>
                          <span>Margin: {Number(category.margin) || 0}%</span>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">No category data available. Upload sales and run forecasts.</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Regional Distribution</CardTitle>
                <CardDescription>Revenue by region (from sales data)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4">
                  <div className="h-[200px] w-full min-w-0 flex justify-center items-center">
                    {regionalData.length > 0 ? (
                      <PieChart width={320} height={200}>
                        <Pie
                          data={regionalData.map((r, idx) => ({ ...r, color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][idx % 5] }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {regionalData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][index % 5]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value, name, props) => {
                            const revenue = props?.payload?.revenue ?? 0;
                            return [`${value}% (${formatCurrency(revenue)})`, name];
                          }}
                        />
                      </PieChart>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">No regional data available</div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {regionalData.length > 0 ? regionalData.map((region, index) => {
                      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
                      const regionColor = colors[index % colors.length];
                      return (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: regionColor }}
                            />
                            <span className="font-medium">{region.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground">{formatCurrency(region.revenue)}</span>
                            <span className={`text-xs font-medium ${
                              region.growth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                              {region.growth >= 0 ? '+' : ''}{region.growth}%
                            </span>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="text-center py-4 text-gray-500 dark:text-gray-400">No regional data available</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <p className="text-sm text-muted-foreground">Insights informed by sales, inventory, and forecast (post-prediction). Generate from Insights page after running forecasts.</p>
          <div className="grid grid-cols-1 gap-6">
            {strategicInsights.map((insight) => (
              <Card key={insight.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`w-3 h-3 rounded-full mt-2 ${
                      insight.type === 'opportunity' ? 'bg-green-500' :
                      insight.type === 'efficiency' ? 'bg-blue-500' : 'bg-red-500'
                    }`} />
                    
                    <div className="flex-1 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-lg">{insight.title}</h4>
                            <Badge variant={insight.impact === 'High' ? 'destructive' : 'secondary'}>
                              {insight.impact} Impact
                            </Badge>
                            <Badge variant="outline" className="gap-1">
                              <Sparkles className="w-3 h-3" />
                              {insight.confidence}% AI Confidence
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{insight.description}</p>
                        </div>
                        
                        <div className="text-right">
                          {insight.potentialRevenue && (
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                              +{formatCurrency(insight.potentialRevenue)}
                            </div>
                          )}
                          {insight.potentialSavings && (
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                              {formatCurrency(insight.potentialSavings)}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            Potential {insight.potentialRevenue ? 'Revenue' : 'Savings'}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Zap className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                          Recommended Actions
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          {insight.actionItems.map((action, idx) => (
                            <div 
                              key={idx}
                              className="flex items-center gap-2 text-sm p-2 bg-gray-50 dark:bg-neutral-800 rounded-lg"
                            >
                              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                              <span>{action}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          Action required by {new Date(insight.deadline).toLocaleDateString()}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => navigate('/executive/insights')}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </Button>
                          <Button size="sm" onClick={() => navigate('/executive/messages')}>
                            Take Action
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Forecast vs Actual Performance</CardTitle>
              <CardDescription>Compare actual (sales) vs forecast (post-prediction) and previous period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {kpiComparison.map((item, index) => (
                  <div key={index} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.metric}</span>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-right">
                          <div className="font-semibold">
                            {typeof item.actual === 'number' && item.actual > 1000 
                              ? formatCurrency(item.actual)
                              : item.actual.toLocaleString()
                            }
                          </div>
                          <div className="text-muted-foreground">Actual</div>
                        </div>
                        <div className="text-right">
                          <div className="text-muted-foreground">
                            {typeof item.forecast === 'number' && item.forecast > 1000
                              ? formatCurrency(item.forecast)
                              : item.forecast.toLocaleString()
                            }
                          </div>
                          <div className="text-muted-foreground">Forecast</div>
                        </div>
                        <div className="text-right">
                          <div className="text-muted-foreground">
                            {typeof item.previous === 'number' && item.previous > 1000
                              ? formatCurrency(item.previous)
                              : item.previous.toLocaleString()
                            }
                          </div>
                          <div className="text-muted-foreground">Previous</div>
                        </div>
                      </div>
                    </div>

                    {(() => {
                      const maxVal = Math.max(item.actual, item.forecast, item.previous, 1);
                      const actualPct = (item.actual / maxVal) * 100;
                      const forecastPct = (item.forecast / maxVal) * 100;
                      const previousPct = (item.previous / maxVal) * 100;

                      return (
                        <div className="relative h-6 bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden flex items-center shadow-inner">
                          {/* Previous Period reference (subtle amber overlay background) */}
                          <div 
                            className="absolute h-full bg-amber-500/10 border-r border-amber-500/30"
                            style={{ width: `${previousPct}%` }}
                            title={`Previous: ${item.previous}`}
                          />
                          
                          {/* Actual Performance (solid high-contrast blue gradient) */}
                          <div 
                            className="absolute h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-l-lg"
                            style={{ width: `${actualPct}%` }}
                            title={`Actual: ${item.actual}`}
                          />

                          {/* AI Forecast Target (vertical dashed green line with overlay target badge) */}
                          <div 
                            className="absolute h-full border-r-2 border-dashed border-emerald-500 flex items-center justify-end"
                            style={{ width: `${forecastPct}%` }}
                            title={`Forecast Target: ${item.forecast}`}
                          >
                            <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-neutral-900 border border-emerald-500/20 px-1 py-0 rounded transform translate-x-1/2 -translate-y-2.5 shadow-sm select-none z-10">
                              Target
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-medium ${
                        item.forecast > 0 ? (item.actual >= item.forecast ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : 'text-muted-foreground'
                      }`}>
                        {item.forecast > 0 ? `${((item.actual - item.forecast) / item.forecast * 100).toFixed(1)}% vs forecast` : '— vs forecast'}
                      </span>
                      <span className={`font-medium ${
                        item.previous > 0 ? (item.actual >= item.previous ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : 'text-muted-foreground'
                      }`}>
                        {item.previous > 0 ? `${((item.actual - item.previous) / item.previous * 100).toFixed(1)}% vs previous` : '— vs previous'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Strategic Activity Feed</CardTitle>
              <CardDescription>Latest high-level events and approvals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.length > 0 ? recentActivity.map((activity) => {
                  const Icon = activity.icon;
                  return (
                    <div key={activity.id} className="flex items-start gap-4 p-4 border rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all dark:border-neutral-700">
                      <div className={`p-2 rounded-lg bg-gray-50 dark:bg-neutral-800`}>
                        <Icon className={`h-5 w-5 ${activity.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">{activity.title}</h4>
                          <span className="text-sm text-muted-foreground">{activity.time}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{activity.description}</p>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-center py-20 opacity-50">
                     <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                     <p>No strategic activities logged in this period.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Business Health Score</CardTitle>
                <CardDescription>Includes forecast accuracy and post-prediction metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center space-y-2">
                  {healthMetrics.length > 0 ? (() => {
                    const avgScore = Math.round(healthMetrics.reduce((sum, m) => sum + m.score, 0) / healthMetrics.length);
                    return (
                      <>
                        <div className="text-6xl font-bold text-green-500 dark:text-green-400">{avgScore}</div>
                        <div className="text-sm text-muted-foreground">out of 100</div>
                        <Badge variant="outline" className="text-green-600 dark:text-green-400">
                          {avgScore >= 90 ? 'Excellent Performance' : avgScore >= 70 ? 'Good Performance' : 'Needs Improvement'}
                        </Badge>
                      </>
                    );
                  })() : (
                    <>
                      <div className="text-6xl font-bold text-gray-400 dark:text-gray-500">0</div>
                      <div className="text-sm text-muted-foreground">out of 100</div>
                    </>
                  )}
                </div>

                <div className="h-[200px]">
                  {healthMetrics.length > 0 ? (() => {
                    const avgScore = Math.round(healthMetrics.reduce((sum, m) => sum + m.score, 0) / healthMetrics.length);
                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart 
                          cx="50%" 
                          cy="50%" 
                          innerRadius="30%" 
                          outerRadius="100%" 
                          data={[{ name: 'Score', value: avgScore, fill: '#10b981' }]}
                          startAngle={90}
                          endAngle={-270}
                        >
                          <RadialBar
                            minAngle={15}
                            background
                            clockWise
                            dataKey="value"
                            cornerRadius={10}
                          />
                        </RadialBarChart>
                      </ResponsiveContainer>
                    );
                  })() : (
                    <div className="flex items-center justify-center h-full text-gray-500">No data available</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Health Metrics Breakdown</CardTitle>
                <CardDescription>Performance across key business areas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {healthMetrics.length > 0 ? healthMetrics.map((metric, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{metric.name}</span>
                        <div className="flex items-center gap-2">
                          {metric.trend === 'up' && (
                            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                          )}
                          {metric.trend === 'down' && (
                            <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                          )}
                          <span className="text-muted-foreground">{metric.score}/100</span>
                        </div>
                      </div>
                      <div className="relative w-full bg-gray-200 dark:bg-neutral-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            metric.score >= 90 ? 'bg-green-500' :
                            metric.score >= 70 ? 'bg-blue-500' :
                            metric.score >= 50 ? 'bg-orange-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${metric.score}%` }}
                        />
                      </div>
                      {metric.change !== 0 && (
                        <div className={`text-xs ${
                          metric.change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {metric.change > 0 ? '+' : ''}{metric.change} points from last period
                        </div>
                      )}
                    </div>
                  )) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">No health metrics available</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="simulator" className="space-y-6">
          <Card className="border-0 shadow-xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-white dark:from-neutral-800 dark:to-neutral-900 border-b">
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-purple-600" />
                Executive Scenario Simulator Sandbox
              </CardTitle>
              <CardDescription>Drag the controls below to model dynamic business price shifts and cost savings.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Simulator Controls */}
                <div className="space-y-6 bg-neutral-50 dark:bg-neutral-900/50 p-6 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Price Adjustment</label>
                      <span className={`text-sm font-black ${simPriceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {simPriceChange > 0 ? '+' : ''}{simPriceChange}%
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="-20" max="20" step="1"
                      value={simPriceChange}
                      onChange={(e) => setSimPriceChange(parseInt(e.target.value))}
                      className="w-full accent-purple-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-neutral-400 font-bold uppercase">
                      <span>-20% (Discount)</span>
                      <span>Standard</span>
                      <span>+20% (Premium)</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">OpEx Cost Efficiency</label>
                      <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                        {simCostReduction}% Save
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="15" step="0.5"
                      value={simCostReduction}
                      onChange={(e) => setSimCostReduction(parseFloat(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-neutral-400 font-bold uppercase">
                      <span>Current Costs</span>
                      <span>High Efficiency</span>
                    </div>
                  </div>

                  <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-xl border border-purple-100/50 dark:border-purple-900/30">
                    <h4 className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 mb-1 tracking-wider">AI Impact Report</h4>
                    <p className="text-xs text-purple-900 dark:text-purple-300 leading-relaxed italic">
                      "A pricing model shift of {simPriceChange}% combined with an OpEx reduction of {simCostReduction}% is simulated to result in a 
                      <span className="font-extrabold text-purple-700 dark:text-purple-400 mx-1">
                        {simProfitChange.toFixed(1)}% {simProfitChange >= 0 ? 'increase' : 'decrease'}
                      </span>
                      in net operating profits next period."
                    </p>
                  </div>
                </div>

                {/* Simulator Projections and Charts */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Simulated Revenue</div>
                      <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                        {formatCurrency(simulatedProjections.revenue)}
                      </div>
                      <div className={`text-xs flex items-center gap-1 mt-1 font-bold ${simPriceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {simPriceChange >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {Math.abs(simPriceChange)}% vs base period
                      </div>
                    </div>

                    <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Simulated Net Profit</div>
                      <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(simulatedProjections.profit)}
                      </div>
                      <div className={`text-xs flex items-center gap-1 mt-1 font-bold ${simProfitChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {simProfitChange >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {Math.abs(simProfitChange).toFixed(1)}% vs base period
                      </div>
                    </div>
                  </div>

                  <div className="h-[200px] bg-neutral-50 dark:bg-neutral-900/30 rounded-2xl p-4 border border-neutral-100 dark:border-neutral-800">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Current Base', Revenue: baseRevenue, Profit: baseProfit },
                        { name: 'Simulated Scenario', Revenue: simulatedProjections.revenue, Profit: simulatedProjections.profit }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(val) => `FRW ${val/1000000}M`} />
                        <Tooltip formatter={(val) => formatCurrency(val)} />
                        <Legend />
                        <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}