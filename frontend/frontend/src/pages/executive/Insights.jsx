import { useState, useEffect } from 'react';
import { Lightbulb, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, ArrowRight, Brain, RefreshCw, BarChart3, Globe, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Insights() {
  const [insights, setInsights] = useState([]);
  const [stats, setStats] = useState({ total: 0, opportunities: 0, warnings: 0, successes: 0 });
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const filterParam = filter !== 'all' ? `?type=${filter}&dismissed=false` : '?dismissed=false';
      
      const [insightsRes, statsRes] = await Promise.all([
        fetch(`http://localhost:3001/api/insights${filterParam}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('http://localhost:3001/api/insights/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (insightsRes.ok) {
        const data = await insightsRes.json();
        setInsights(data.data?.insights || data.insights || data || []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.data || data || { total: 0, opportunities: 0, warnings: 0, successes: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate fresh AI insights whenever the filter changes (and on first load)
  useEffect(() => {
    const generateAndFetch = async () => {
      try {
        const token = localStorage.getItem('token');
        await fetch('http://localhost:3001/api/insights/generate', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => {});
      } finally {
        // Always refresh the list, even if generation fails
        await fetchData();
      }
    };

    generateAndFetch();
  }, [filter]);

  const dismissInsight = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/insights/${id}/dismiss`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setInsights(insights.filter(i => i.id !== id));
      }
    } catch (error) {
      console.error('Failed to dismiss insight:', error);
    }
  };

  const getTypeStyle = (type) => {
    const styles = {
      opportunity: { bg: 'bg-emerald-50 border-emerald-200', icon: TrendingUp, iconBg: 'bg-emerald-100 text-emerald-600' },
      warning: { bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle, iconBg: 'bg-amber-100 text-amber-600' },
      success: { bg: 'bg-blue-50 border-blue-200', icon: CheckCircle, iconBg: 'bg-blue-100 text-blue-600' },
      info: { bg: 'bg-gray-50 border-gray-200', icon: Lightbulb, iconBg: 'bg-gray-100 text-gray-600' }
    };
    return styles[type] || styles.info;
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      high: 'bg-red-100 text-red-700 border-red-200',
      medium: 'bg-amber-100 text-amber-700 border-amber-200',
      low: 'bg-gray-100 text-gray-700 border-gray-200'
    };
    return badges[priority] || badges.medium;
  };

  // Trend analysis data - fetch from real data
  const [trendData, setTrendData] = useState([]);
  // Forecast-driven market and competitive metrics
  const [marketData, setMarketData] = useState([]);
  const [competitiveData, setCompetitiveData] = useState([]);

  // Shared loader for Demand vs Supply vs Forecast trends
  const fetchTrendData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [salesRes, forecastRes] = await Promise.all([
        fetch('http://localhost:3001/api/dashboard/sales-chart?days=210', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('http://localhost:3001/api/dashboard/forecast-chart?days=210', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (salesRes.ok && forecastRes.ok) {
        const salesData = await salesRes.json();
        const forecastData = await forecastRes.json();
        
        const salesChart = salesData.chartData || [];
        const forecastChart = forecastData.chartData || [];
        
        // Group by month
        const monthly = {};
        salesChart.forEach(item => {
          const month = new Date(item.date).toLocaleDateString('en-US', { month: 'short' });
          if (!monthly[month]) {
            monthly[month] = { month, demand: 0, supply: 0, forecast: 0 };
          }
          monthly[month].demand += item.quantity || 0;
          monthly[month].supply += item.quantity || 0; // Simplified
        });
        
        forecastChart.forEach(item => {
          const month = new Date(item.date).toLocaleDateString('en-US', { month: 'short' });
          if (!monthly[month]) {
            monthly[month] = { month, demand: 0, supply: 0, forecast: 0 };
          }
          monthly[month].forecast += item.forecasted_demand || 0;
        });
        
        const trend = Object.values(monthly).slice(-7);
        setTrendData(trend.length > 0 ? trend : [
          { month: 'Jan', demand: 0, supply: 0, forecast: 0 }
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch trend data:', error);
      setTrendData([
        { month: 'Jan', demand: 0, supply: 0, forecast: 0 }
      ]);
    }
  };

  // Shared loader for Market Intelligence + Competitive Benchmarking
  const fetchForecastInsights = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/dashboard/demand-forecast-metrics?days=365', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;

      const raw = await res.json();
      const metrics = raw.data || raw || {};

      const seasonality = metrics.seasonalityData || [];
      let market = seasonality.map((row) => ({
        category: new Date(2000, (row.month || 1) - 1, 1).toLocaleDateString('en-US', { month: 'short' }),
        growth: (row.avg_seasonality || 0) * 100,
        marketShare: 0,
        trend: (row.avg_seasonality || 0) >= 1 ? 'up' : 'down'
      }));

      try {
        const catRes = await fetch('http://localhost:3001/api/dashboard/category-performance?days=90', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (catRes.ok) {
          const catRaw = await catRes.json();
          const perf = catRaw.performance || [];
          const totalRev = perf.reduce((s, p) => s + Number(p.revenue || 0), 0);
          if (perf.length > 0) {
            market = perf.slice(0, 8).map((p) => ({
              category: p.category || 'Uncategorized',
              growth: Number(p.revenue || 0),
              marketShare: totalRev > 0 ? Math.round((Number(p.revenue || 0) / totalRev) * 1000) / 10 : 0,
              trend: Number(p.forecast_revenue || 0) >= Number(p.revenue || 0) ? 'up' : 'down',
            }));
          }
        }
      } catch {
        // keep seasonality fallback
      }
      setMarketData(market);

      const modelPerf = metrics.modelPerformance || [];
      const competitive = modelPerf.map((m) => ({
        metric: m.model_type || 'Model',
        score: Number(m.accuracy) || 0,
        industry: 80
      }));
      setCompetitiveData(competitive);
    } catch (error) {
      console.error('Failed to fetch forecast-based insight metrics:', error);
    }
  };

  // Initial loads
  useEffect(() => {
    fetchTrendData();
  }, []);

  useEffect(() => {
    fetchForecastInsights();
  }, []);

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
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Lightbulb className="w-7 h-7 text-amber-600" />
            Insights
          </h1>
          <p className="text-gray-500 mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg text-sm border border-amber-200">
            <Brain className="w-4 h-4" />
            <span>Powered by AI</span>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              // On manual refresh: regenerate AI insights and refetch all charts
              setLoading(true);
              try {
                const token = localStorage.getItem('token');
                await fetch('http://localhost:3001/api/insights/generate', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}` }
                }).catch(() => {});
                await Promise.all([
                  fetchData(),
                  fetchTrendData(),
                  fetchForecastInsights()
                ]);
              } finally {
                setLoading(false);
              }
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div 
          className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4 cursor-pointer hover:shadow-md transition-shadow hover:border-amber-300"
          onClick={() => setFilter('all')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Insights</div>
              <div className="text-xl font-bold text-gray-900">{stats.total || 0}</div>
            </div>
          </div>
        </div>
        <div 
          className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4 cursor-pointer hover:shadow-md transition-shadow hover:border-emerald-300"
          onClick={() => setFilter('opportunity')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Opportunities</div>
              <div className="text-xl font-bold text-emerald-600">{stats.opportunities || 0}</div>
            </div>
          </div>
        </div>
        <div 
          className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4 cursor-pointer hover:shadow-md transition-shadow hover:border-amber-300"
          onClick={() => setFilter('warning')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Warnings</div>
              <div className="text-xl font-bold text-amber-600">{stats.warnings || 0}</div>
            </div>
          </div>
        </div>
        <div 
          className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4 cursor-pointer hover:shadow-md transition-shadow hover:border-blue-300"
          onClick={() => setFilter('success')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Successes</div>
              <div className="text-xl font-bold text-blue-600">{stats.successes || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ai" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ai">AI Insights</TabsTrigger>
          <TabsTrigger value="trends">Trends Analysis</TabsTrigger>
          <TabsTrigger value="market">Market Intelligence</TabsTrigger>
          <TabsTrigger value="competitive">Competitive Analysis</TabsTrigger>
        </TabsList>

        {/* AI Insights Tab */}
        <TabsContent value="ai" className="space-y-4">
          <div className="space-y-4">
            {insights.length > 0 ? insights.map((insight) => {
              const style = getTypeStyle(insight.insight_type);
              const Icon = style.icon;
              
              return (
                <div key={insight.id} className={`rounded-xl border p-6 ${style.bg}`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${style.iconBg}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900">{insight.title}</h3>
                            <Badge className={getPriorityBadge(insight.priority)}>
                              {insight.priority?.charAt(0).toUpperCase() + insight.priority?.slice(1)} Priority
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {new Date(insight.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => dismissInsight(insight.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          Dismiss
                        </Button>
                      </div>
                      
                      <p className="text-gray-600 mb-4">{insight.description}</p>
                      
                      <div className="flex flex-wrap items-center gap-4">
                        {insight.impact && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-500">Impact:</span>
                            <span className="font-medium text-gray-900">{insight.impact}</span>
                          </div>
                        )}
                        {insight.recommended_action && (
                          <Button variant="outline" size="sm">
                            {insight.recommended_action}
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700 p-12 text-center">
                <Lightbulb className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No insights found</h3>
                <p className="text-gray-500 mt-1">No insights match the current filter.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Trends Analysis Tab */}
        <TabsContent value="trends" className="space-y-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-600" />
              Demand vs Supply Trends
            </h2>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="demand" stroke="#ef4444" strokeWidth={2} name="Demand" />
                  <Line type="monotone" dataKey="supply" stroke="#10b981" strokeWidth={2} name="Supply" />
                  <Line type="monotone" dataKey="forecast" stroke="#3b82f6" strokeWidth={2} name="Forecast" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        {/* Market Intelligence Tab */}
        <TabsContent value="market" className="space-y-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-amber-600" />
              Market Growth Analysis
            </h2>
            <div className="h-[400px]">
              {marketData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={marketData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="growth" fill="#10b981" name="Growth %" />
                    <Bar dataKey="marketShare" fill="#3b82f6" name="Market Share %" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  No forecast-based market data available yet.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Competitive Analysis Tab */}
        <TabsContent value="competitive" className="space-y-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-600" />
              Competitive Benchmarking
            </h2>
            <div className="h-[400px]">
              {competitiveData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={competitiveData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="metric" angle={-45} textAnchor="end" height={100} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="score" fill="#3b82f6" name="Model Accuracy %" />
                    <Bar dataKey="industry" fill="#94a3b8" name="Benchmark %" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  No forecast model performance data available yet.
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
