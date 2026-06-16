import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { 
  TrendingUp, Package, Factory, Truck, AlertTriangle, DollarSign, 
  ShieldCheck, Brain, Play, RefreshCw, Layers, Calendar, 
  ChevronRight, Activity, Sparkles, CheckCircle2, ShieldAlert 
} from 'lucide-react';
import { apiGet, apiPost } from '../../utils/api';
import { formatCurrency } from '../../utils/currency';

export default function OperationsDashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    salesThisMonth: null,
    predictionRevenue: null,
    actualRevenue: null,
    procurementDeductions: null,
    salesGrowth: null,
    forecastAccuracy: null,
    pendingOrders: null,
    lowStockAlerts: null,
    productionBacklog: null,
    resilienceIndex: null,
    stockoutRiskRevenue: 0
  });
  const [recentForecasts, setRecentForecasts] = useState([]);
  const [alertsList, setAlertsList] = useState([]);
  const [plansList, setPlansList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

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

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsResp, salesStatsResp, forecastsResp, alertsResp, procurementResp, productionResp, plansResp] = await Promise.all([
        apiGet('/api/dashboard/stats?days=30').catch(() => ({ stats: {} })),
        apiGet('/api/sales/stats?days=30').catch(() => ({ totalRevenue: 0, totalQuantity: 0, totalRecords: 0 })),
        apiGet('/api/forecast?days=365').catch(() => ({ forecasts: [] })),
        apiGet('/api/inventory/alerts?severity=high').catch(() => ({ alerts: [] })),
        apiGet('/api/procurement/stats').catch(() => ({ pending: 0, total_orders: 0, total_value: 0 })),
        apiGet('/api/production/stats').catch(() => ({ total: 0, in_progress: 0, delayed: 0 })),
        apiGet('/api/production').catch(() => [])
      ]);

      const dashStats = statsResp?.stats || {};
      const forecasts = forecastsResp || { forecasts: [] };
      const alerts = alertsResp || { alerts: [] };
      const procurement = procurementResp || {};
      const production = productionResp || {};

      const monthlyRevenue = Number(salesStatsResp?.totalRevenue || 0);
      const growthPct = dashStats.sales_growth_pct ?? 0;

      let accuracy =
        typeof dashStats.forecast_accuracy === 'number'
          ? dashStats.forecast_accuracy
          : 0;

      if ((!accuracy || accuracy <= 0) && Array.isArray(forecasts.forecasts) && forecasts.forecasts.length > 0) {
        const confidences = forecasts.forecasts
          .map((f) => {
            const raw = f.confidence_level;
            const numeric = typeof raw === 'number' ? raw : Number(raw);
            return Number.isFinite(numeric) && numeric > 0 && numeric <= 1 ? numeric : 0.95;
          });
        if (confidences.length > 0) {
          const avgConfidence =
            confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
          accuracy = Math.round(avgConfidence * 100);
        }
      }

      const pendingOrders =
        procurement?.pending ??
        dashStats.pending_orders ??
        null;

      const lowStockCount = Array.isArray(alerts.alerts)
        ? alerts.alerts.length
        : dashStats.critical_alerts ?? null;

      const productionBacklog =
        typeof production.in_progress === 'number' || typeof production.delayed === 'number'
          ? (production.in_progress || 0) + (production.delayed || 0)
          : dashStats.production_backlog ?? null;

      setMetrics({
        salesThisMonth: Number(dashStats.net_revenue ?? dashStats.total_revenue ?? salesStatsResp?.totalRevenue ?? 0),
        predictionRevenue: Number(dashStats.prediction_revenue ?? dashStats.total_revenue_forecast ?? 0),
        actualRevenue: Number(dashStats.actual_revenue ?? 0),
        procurementDeductions: Number(dashStats.procurement_deductions ?? 0),
        salesGrowth: typeof growthPct === 'number' ? growthPct : null,
        forecastAccuracy: accuracy > 0 ? accuracy : null,
        pendingOrders,
        lowStockAlerts: lowStockCount,
        productionBacklog,
        resilienceIndex: typeof dashStats.resilience_index === 'number' ? dashStats.resilience_index : null,
        stockoutRiskRevenue: Number(dashStats.stockout_risk_revenue ?? 0)
      });

      // Filter and limit recent plans list to active statuses: in_progress, delayed, scheduled
      const activePlans = Array.isArray(plansResp)
        ? plansResp.filter(p => p.status === 'in_progress' || p.status === 'delayed' || p.status === 'scheduled')
        : [];
      setPlansList(activePlans.slice(0, 5));

      const sortedAlerts = Array.isArray(alerts.alerts) ? alerts.alerts.slice() : [];
      setAlertsList(sortedAlerts.slice(0, 5));

      if (forecasts.forecasts && forecasts.forecasts.length > 0) {
        const latestForecasts = forecasts.forecasts.slice(0, 5).map(f => ({
          product: f.product_name || 'Product',
          forecast: f.forecasted_demand || 0,
          trend: f.trend_indicator || 'stable',
          confidence: Math.round((f.confidence_level || 0.95) * 100)
        }));
        setRecentForecasts(latestForecasts);
      } else {
        setRecentForecasts([]);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFromForecasts = async () => {
    try {
      setGenerating(true);
      const res = await apiPost('/api/production/generate-from-forecasts', {});
      if (res && typeof res.created === 'number' && res.created > 0) {
        setNotification({
          type: 'success',
          message: `Successfully generated ${res.created} production plans matching active demand forecasts!`
        });
        setTimeout(() => setNotification(null), 8000);
        await fetchDashboardData();
      } else {
        setNotification({
          type: 'info',
          message: 'Zero stock violations forecasted. Active inventory levels are sufficient to cover customer demand plus safety margins.'
        });
        setTimeout(() => setNotification(null), 6000);
      }
    } catch (e) {
      setNotification({
        type: 'error',
        message: e.message || 'Operational orchestration failed to complete.'
      });
      setTimeout(() => setNotification(null), 6000);
    } finally {
      setGenerating(false);
    }
  };

  // Resilience index from backend (pending orders, low stock, production backlog)
  const resilienceIndex = useMemo(() => {
    if (typeof metrics.resilienceIndex === 'number') {
      return metrics.resilienceIndex;
    }
    if (
      metrics.pendingOrders === null &&
      metrics.lowStockAlerts === null &&
      metrics.productionBacklog === null
    ) {
      return null;
    }
    const pending = Number(metrics.pendingOrders || 0);
    const lowStock = Number(metrics.lowStockAlerts || 0);
    const backlog = Number(metrics.productionBacklog || 0);
    const rawResilience = 99.5 - (pending * 1.5 + lowStock * 4.5 + backlog * 2.0);
    return Math.max(35, Math.min(99, Math.round(rawResilience)));
  }, [metrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-neutral-100 dark:to-neutral-400 bg-clip-text text-transparent">Kinglion Operations</h1>
          <p className="text-muted-foreground">Demand forecasting and production planning for Kinglion Rwanda Investment Ltd</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-1.5" onClick={fetchDashboardData}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
          <Button className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25 gap-1.5 text-white" asChild>
            <Link to="/operations/production-plan">
              <Factory className="w-4 h-4" />
              Manage Production
            </Link>
          </Button>
        </div>
      </div>

      {notification && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all duration-300 shadow-md ${
          notification.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-900/50 dark:text-green-300' 
            : notification.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-300'
            : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-900/50 dark:text-blue-300'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600 mt-0.5" />
          ) : notification.type === 'error' ? (
            <ShieldAlert className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
          ) : (
            <Brain className="w-5 h-5 shrink-0 text-blue-600 mt-0.5" />
          )}
          <div className="flex-1 text-sm font-medium">{notification.message}</div>
          <button onClick={() => setNotification(null)} className="text-xs font-bold hover:underline opacity-80">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card 
          className="hover:-translate-y-1 hover:shadow-md transition-all duration-300 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 cursor-pointer"
          onClick={() => navigate('/operations/sales-data')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {metrics.salesThisMonth !== null ? formatCurrency(metrics.salesThisMonth) : 'No sales data'}
          </div>
            <p className="text-xs text-gray-500 mt-1">
              Sold/stock-out minus procurement (Excel upload does not count)
              {metrics.procurementDeductions > 0 ? ` (−${formatCurrency(metrics.procurementDeductions)})` : ''}
            </p>
          </CardContent>
        </Card>

        <Card 
          className="hover:-translate-y-1 hover:shadow-md transition-all duration-300 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 cursor-pointer"
          onClick={() => navigate('/operations/demand-forecast')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Prediction Revenue</CardTitle>
            <Brain className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {metrics.predictionRevenue !== null ? formatCurrency(metrics.predictionRevenue) : 'N/A'}
          </div>
            <p className="text-xs text-gray-500 mt-1">Forecast demand × unit price (30d)</p>
          </CardContent>
        </Card>

        <Card 
          className="hover:-translate-y-1 hover:shadow-md transition-all duration-300 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 cursor-pointer"
          onClick={() => navigate('/operations/demand-forecast')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Forecast Accuracy</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {metrics.forecastAccuracy !== null ? `${metrics.forecastAccuracy}%` : 'N/A'}
          </div>
            <p className="text-xs text-gray-500 mt-1">
              {metrics.forecastAccuracy !== null
                ? metrics.forecastAccuracy >= 90
                  ? 'Forecast performance is on target'
                  : 'Review forecast model and data quality'
                : 'Forecast data not available'}
            </p>
          </CardContent>
        </Card>

        <Card 
          className="hover:-translate-y-1 hover:shadow-md transition-all duration-300 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 cursor-pointer"
          onClick={() => navigate('/operations/procurement-plan')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Pending Orders</CardTitle>
            <Package className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {metrics.pendingOrders !== null ? metrics.pendingOrders : 'N/A'}
          </div>
            <p className="text-xs text-gray-500 mt-1">
              {metrics.pendingOrders !== null
                ? metrics.pendingOrders > 0
                  ? 'Requires attention'
                  : 'No pending orders'
                : 'Order status unavailable'}
            </p>
          </CardContent>
        </Card>

        <Card 
          className={`border-0 shadow-lg text-white bg-gradient-to-br transition-all duration-500 hover:-translate-y-1 hover:shadow-xl cursor-pointer ${
            resilienceIndex === null
              ? 'from-slate-500 to-slate-600'
              : resilienceIndex >= 85
              ? 'from-emerald-500 to-emerald-600'
              : resilienceIndex >= 65
              ? 'from-amber-500 to-amber-600'
              : 'from-rose-500 to-rose-600'
          }`}
          onClick={() => navigate('/operations/production-plan')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-white/90">Supply Chain Resilience</CardTitle>
            <ShieldCheck className="h-5 w-5 text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{resilienceIndex !== null ? `${resilienceIndex}%` : 'N/A'}</div>
            {resilienceIndex !== null ? (
              <>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white transition-all duration-500" style={{ width: `${resilienceIndex}%` }}></div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {resilienceIndex >= 85 ? 'Optimized' : resilienceIndex >= 65 ? 'Constrained' : 'Vulnerable'}
                  </span>
                </div>
                <p className="text-[10px] text-white/95 mt-3 italic leading-tight">
                  {resilienceIndex >= 85
                    ? 'Excellent coverage. Low stock alerts and production delays are under control.'
                    : resilienceIndex >= 65
                    ? 'Constrained. Work on supply chain priorities and production capacity.'
                    : 'High risk. Resolve stock alerts and backlog issues first.'}
                </p>
              </>
            ) : (
              <p className="text-[10px] text-white/95 mt-3 italic leading-tight">Insufficient data to calculate resilience index.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 dark:bg-neutral-900 overflow-hidden">
        <CardHeader className="border-b dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-900/50 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Factory className="w-5 h-5 text-blue-500 animate-pulse" />
                Live Production Runs & AI Orchestrator
              </CardTitle>
              <CardDescription>Track running assemblies or initiate AI auto-suggestion plans matching active forecasts.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleGenerateFromForecasts}
                disabled={generating}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-lg shadow-blue-500/20 text-xs px-4 py-2 font-semibold"
              >
                <Brain className="w-3.5 h-3.5" />
                {generating ? 'Orchestrating...' : 'AI Auto-Suggest Plans'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {plansList.length === 0 ? (
            <div className="p-12 text-center">
              <Sparkles className="w-10 h-10 text-blue-400 mx-auto mb-3 opacity-60" />
              <p className="font-semibold text-gray-700 dark:text-gray-300">No active production runs found</p>
              <p className="text-sm text-gray-500 max-w-md mx-auto mt-1">
                Your assembly lines are idle. Click <strong className="text-blue-600 cursor-pointer hover:underline" onClick={handleGenerateFromForecasts}>AI Auto-Suggest Plans</strong> above to convert demand forecasts into optimized production schedules.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="p-4 pl-6 text-gray-600 dark:text-gray-350">Product / SKU</th>
                    <th className="p-4 text-gray-600 dark:text-gray-350">Priority / Schedule</th>
                    <th className="p-4 text-gray-600 dark:text-gray-350">Progress Tracker</th>
                    <th className="p-4 text-gray-600 dark:text-gray-350">Completed</th>
                    <th className="p-4 pr-6 text-right text-gray-600 dark:text-gray-350">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {plansList.map((plan) => {
                    const pct = plan.status === 'completed'
                      ? 100
                      : Math.min(100, Math.round(((plan.completed_quantity || 0) / (plan.target_quantity || 1)) * 100));
                    const statusColors = {
                      scheduled: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-450',
                      in_progress: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-455',
                      delayed: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-455',
                      completed: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300'
                    };
                    const priorityColors = {
                      high: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/40 dark:text-rose-400',
                      medium: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/40 dark:text-amber-400',
                      low: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/40 dark:text-blue-450'
                    };
                    return (
                      <tr key={plan.id} className="hover:bg-gray-50/50 dark:hover:bg-neutral-900/50 transition-colors">
                        <td className="p-4 pl-6">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{plan.product_name}</span>
                            <span className="text-xs text-gray-500 font-mono mt-0.5">{plan.sku}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            <span className={`text-[10px] w-fit font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${priorityColors[plan.priority] || 'bg-gray-100 text-gray-600'}`}>
                              {plan.priority} Priority
                            </span>
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(plan.start_date).toLocaleDateString()} - {new Date(plan.end_date).toLocaleDateString()}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 w-[220px]">
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="h-2 flex-1" />
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 shrink-0">{pct}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-gray-700 dark:text-gray-300 font-medium">
                          {plan.completed_quantity} / {plan.target_quantity} <span className="text-xs text-gray-400 font-normal">units</span>
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded border uppercase tracking-wider ${statusColors[plan.status] || 'bg-gray-100 text-gray-600'}`}>
                            {plan.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="hover:shadow-xl transition-all duration-300 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Demand Forecasts
          </CardTitle>
          <CardDescription>AI-generated predictions for next month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentForecasts.length > 0 ? recentForecasts.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50/50 dark:hover:bg-neutral-800/30 transition-colors border-gray-150 dark:border-neutral-800">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">{item.product}</h4>
                  <p className="text-sm text-gray-500">
                    Forecast: {item.forecast} units • Confidence: {item.confidence}%
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.trend === 'increasing' ? 'default' : 'secondary'}>
                    {item.trend === 'increasing' ? '↗ Increasing' : item.trend === 'decreasing' ? '↘ Decreasing' : '→ Stable'}
                  </Badge>
                </div>
              </div>
            )) : (
              <p className="text-center text-muted-foreground py-8">No forecasts available. Generate forecasts to see predictions.</p>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
