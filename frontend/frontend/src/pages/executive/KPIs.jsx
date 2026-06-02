import { useState, useEffect } from 'react';
import { Target, TrendingUp, TrendingDown, DollarSign, Package, Users, Percent, BarChart3, RefreshCw, Filter } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../utils/currency';

export default function KPIs() {
  const [kpis, setKpis] = useState([]);
  const [summary, setSummary] = useState({ on_track: 0, near_target: 0, needs_attention: 0 });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('month');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const getDaysFromRange = (range) => {
    switch (range) {
      case 'week':
        return 7;
      case 'month':
        return 30;
      case 'quarter':
        return 90;
      case 'year':
        return 365;
      case 'two_years':
        return 730;
      default:
        return 30;
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const days = getDaysFromRange(timeRange);
      const [kpisRes, summaryRes, forecastMetricsRes] = await Promise.all([
        fetch('http://localhost:3001/api/kpis', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('http://localhost:3001/api/kpis/summary', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`http://localhost:3001/api/dashboard/demand-forecast-metrics?days=${days}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      let kpisData = [];
      if (kpisRes.ok) {
        const data = await kpisRes.json();
        kpisData = data.data?.kpis || data.kpis || data || [];
      }
      
      // If no KPIs exist, generate them from real forecast metrics only
      if (kpisData.length === 0 && forecastMetricsRes.ok) {
        const rawMetrics = await forecastMetricsRes.json();
        const metrics = rawMetrics.data || rawMetrics || {};
        const fx = metrics.executiveKpis || {};

        const revenue = Number(fx.revenue) || 0;
        const grossMarginPct = Number(fx.grossMarginPct) || 0;
        const inventoryTurnover = Number(fx.inventoryTurnover) || 0;
        const orderFulfilmentPct = Number(fx.orderFulfilmentPct) || 0;
        const productionEfficiency = Number(fx.productionEfficiency) || 0;
        const customerSatisfactionRating = Number(fx.customerSatisfactionRating) || 0;

        kpisData = [
          {
            id: 1,
            name: 'Revenue',
            category: 'financial',
            current_value: revenue,
            target_value: revenue * 1.1,
            unit: 'FRW',
            trend: 'up',
            change_percentage: 0
          },
          {
            id: 2,
            name: 'Gross Margin',
            category: 'financial',
            current_value: grossMarginPct,
            target_value: 36.0,
            unit: '%',
            trend: 'up',
            change_percentage: 0
          },
          {
            id: 3,
            name: 'Inventory Turnover',
            category: 'operations',
            current_value: inventoryTurnover,
            target_value: 3.5,
            unit: 'x',
            trend: 'up',
            change_percentage: 0
          },
          {
            id: 4,
            name: 'Order Fulfillment',
            category: 'operations',
            current_value: orderFulfilmentPct,
            target_value: 99.0,
            unit: '%',
            trend: 'up',
            change_percentage: 0
          },
          {
            id: 5,
            name: 'Customer Satisfaction',
            category: 'customer',
            current_value: customerSatisfactionRating,
            target_value: 4.8,
            unit: '/5',
            trend: 'up',
            change_percentage: 0
          },
          {
            id: 6,
            name: 'Production Efficiency',
            category: 'operations',
            current_value: productionEfficiency,
            target_value: 95.0,
            unit: '%',
            trend: 'up',
            change_percentage: 0
          }
        ];
      }
      
      setKpis(kpisData);
      
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data.data || data || { on_track: 0, near_target: 0, needs_attention: 0 });
      } else {
        // Calculate summary from KPIs
        const onTrack = kpisData.filter(k => (k.current_value / k.target_value * 100) >= 95).length;
        const nearTarget = kpisData.filter(k => {
          const percent = (k.current_value / k.target_value * 100);
          return percent >= 90 && percent < 95;
        }).length;
        const needsAttention = kpisData.filter(k => (k.current_value / k.target_value * 100) < 90).length;
        setSummary({ on_track: onTrack, near_target: nearTarget, needs_attention: needsAttention });
      }
    } catch (error) {
      console.error('Failed to fetch KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (name) => {
    const icons = {
      'Revenue': DollarSign,
      'Gross Margin': Percent,
      'Inventory Turnover': Package,
      'Order Fulfillment': Target,
      'Customer Satisfaction': Users,
      'Production Efficiency': BarChart3
    };
    return icons[name] || Target;
  };

  const getColor = (category) => {
    const colors = {
      financial: { bg: 'bg-emerald-100', text: 'text-emerald-600', progress: 'bg-emerald-500' },
      operations: { bg: 'bg-blue-100', text: 'text-blue-600', progress: 'bg-blue-500' },
      customer: { bg: 'bg-rose-100', text: 'text-rose-600', progress: 'bg-rose-500' },
      growth: { bg: 'bg-purple-100', text: 'text-purple-600', progress: 'bg-purple-500' }
    };
    return colors[category] || colors.operations;
  };

  const filteredKpis = kpis.filter(kpi => {
    if (categoryFilter === 'all') return true;
    return kpi.category === categoryFilter;
  });

  // Trend data - fetch from sales chart
  const [trendData, setTrendData] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);

  useEffect(() => {
    const fetchTrendData = async () => {
      try {
        const token = localStorage.getItem('token');
        const daysForTrend = Math.max(getDaysFromRange(timeRange), 90);
        const salesRes = await fetch(`http://localhost:3001/api/dashboard/sales-chart?days=${daysForTrend}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (salesRes.ok) {
          const data = await salesRes.json();
          const chartData = data.chartData || [];
          
          // Group by month
          const monthly = {};
          chartData.forEach(item => {
            const month = new Date(item.date).toLocaleDateString('en-US', { month: 'short' });
            if (!monthly[month]) {
              monthly[month] = { month, revenue: 0, margin: 0, turnover: 0, count: 0 };
            }
            monthly[month].revenue += item.revenue || 0;
            monthly[month].count += 1;
          });
          
          const trend = Object.values(monthly).slice(-7).map(m => ({
            month: m.month,
            revenue: m.revenue,
            margin: 35.0, // Would need cost data to calculate
            turnover: 3.4 // Would need inventory data
          }));
          
          setTrendData(trend.length > 0 ? trend : [
            { month: 'Jan', revenue: 0, margin: 0, turnover: 0 }
          ]);
        }
      } catch (error) {
        console.error('Failed to fetch trend data:', error);
      }
    };
    
    fetchTrendData();
  }, [timeRange]);

  useEffect(() => {
    // Update performance data from KPIs
    const perfData = kpis.slice(0, 6).map(kpi => ({
      kpi: kpi.name,
      current: kpi.current_value,
      target: kpi.target_value,
      trend: kpi.trend || 'stable'
    }));
    setPerformanceData(perfData);
  }, [kpis]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Target className="w-7 h-7 text-amber-600" />
            KPIs
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-200 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
            <option value="two_years">Last 2 Years</option>
          </select>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={categoryFilter === 'all' ? 'default' : 'outline'}
          onClick={() => setCategoryFilter('all')}
          className={categoryFilter === 'all' ? 'bg-amber-600 hover:bg-amber-700' : ''}
        >
          All Metrics
        </Button>
        <Button
          variant={categoryFilter === 'financial' ? 'default' : 'outline'}
          onClick={() => setCategoryFilter('financial')}
          className={categoryFilter === 'financial' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
        >
          Financial
        </Button>
        <Button
          variant={categoryFilter === 'operations' ? 'default' : 'outline'}
          onClick={() => setCategoryFilter('operations')}
          className={categoryFilter === 'operations' ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          Operational
        </Button>
        <Button
          variant={categoryFilter === 'customer' ? 'default' : 'outline'}
          onClick={() => setCategoryFilter('customer')}
          className={categoryFilter === 'customer' ? 'bg-rose-600 hover:bg-rose-700' : ''}
        >
          Customer
        </Button>
        <Button
          variant={categoryFilter === 'growth' ? 'default' : 'outline'}
          onClick={() => setCategoryFilter('growth')}
          className={categoryFilter === 'growth' ? 'bg-purple-600 hover:bg-purple-700' : ''}
        >
          Growth
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="analysis">Performance Analysis</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredKpis.map((kpi) => {
              const Icon = getIcon(kpi.name);
              const colors = getColor(kpi.category);
              const progress = kpi.target_value > 0 
                ? (parseFloat(kpi.current_value) / parseFloat(kpi.target_value)) * 100 
                : 0;
              
              return (
                <div key={kpi.id} className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 ${colors.bg} rounded-xl flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${colors.text}`} />
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      kpi.trend === 'up' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 
                      kpi.trend === 'down' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' : 
                      'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300'
                    }`}>
                      {kpi.trend === 'up' ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : kpi.trend === 'down' ? (
                        <TrendingDown className="w-3 h-3" />
                      ) : null}
                      {kpi.change_percentage > 0 ? '+' : ''}{kpi.change_percentage || 0}%
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-500">{kpi.name}</h3>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                        {(kpi.unit === 'FRW' || kpi.unit === '$') ? formatCurrency(parseFloat(kpi.current_value)) :
                         kpi.unit === '%' ? `${kpi.current_value}%` :
                         `${kpi.current_value}${kpi.unit || ''}`}
                      </span>
                      <span className="text-sm text-gray-400">
                        / {(kpi.unit === 'FRW' || kpi.unit === '$') ? formatCurrency(parseFloat(kpi.target_value)) :
                           kpi.unit === '%' ? `${kpi.target_value}%` :
                           `${kpi.target_value}${kpi.unit || ''}`}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Progress to target</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">{Math.min(progress, 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-neutral-600 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${colors.progress} transition-all duration-500`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Performance Summary */}
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Performance Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-100 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                  <TrendingUp className="w-5 h-5" />
                  On Track
                </div>
                <div className="text-3xl font-bold text-green-800">{summary.on_track || 0}</div>
                <div className="text-sm text-green-600">KPIs meeting or exceeding targets</div>
              </div>
              <div className="p-4 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-100 dark:border-amber-800">
                <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                  <Target className="w-5 h-5" />
                  Near Target
                </div>
                <div className="text-3xl font-bold text-amber-800">{summary.near_target || 0}</div>
                <div className="text-sm text-amber-600">KPIs within 5% of target</div>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-100 dark:border-red-800">
                <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                  <TrendingDown className="w-5 h-5" />
                  Needs Attention
                </div>
                <div className="text-3xl font-bold text-red-800">{summary.needs_attention || 0}</div>
                <div className="text-sm text-red-600">KPIs below target threshold</div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">KPI Trends Over Time</h2>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip formatter={(value, name) => [name === 'Revenue (FRW)' ? formatCurrency(value) : value, name]} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue (FRW)" />
                  <Line yAxisId="right" type="monotone" dataKey="margin" stroke="#3b82f6" strokeWidth={2} name="Gross Margin (%)" />
                  <Line yAxisId="right" type="monotone" dataKey="turnover" stroke="#f59e0b" strokeWidth={2} name="Inventory Turnover" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        {/* Performance Analysis Tab */}
        <TabsContent value="analysis" className="space-y-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Performance Analysis</h2>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="kpi" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="current" fill="#3b82f6" name="Current Value" />
                  <Bar dataKey="target" fill="#10b981" name="Target Value" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
