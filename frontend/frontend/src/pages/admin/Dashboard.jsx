import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Button } from '../../components/ui/button';
import {
  Users, Upload, Brain, Activity, AlertTriangle, CheckCircle, TrendingUp, TrendingDown,
  ArrowRight, Clock, Shield, Zap, Circle
} from 'lucide-react';
import {
  BarChart as RechartsBarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { apiGet } from '../../utils/api';
import { useNavigate } from 'react-router-dom';


function formatTrend(pct) {
  if (pct === 0 || pct == null) return { change: '—', trend: 'neutral' };
  if (pct > 0) return { change: `+${pct}%`, trend: 'up' };
  return { change: `${pct}%`, trend: 'down' };
}

function ServiceDot({ ok, label }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 dark:bg-neutral-800/80 border border-gray-200 dark:border-neutral-700">
      <Circle className={`w-2.5 h-2.5 fill-current ${ok ? 'text-green-500' : 'text-red-500'}`} />
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <span className={`text-[10px] font-bold uppercase ${ok ? 'text-green-600' : 'text-red-600'}`}>
        {ok ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activityFilter, setActivityFilter] = useState('all');
  const [stats, setStats] = useState({
    totalUsers: 0, activeUsers: 0, dataUploads: 0, recentUploads: 0,
    aiModels: 0, activeModels: 0, systemHealth: 100, alerts: 0,
    userChangePct: 0, uploadChangePct: 0, healthChangePct: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dataUploadTrend, setDataUploadTrend] = useState([]);
  const [aiModels, setAiModels] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [security, setSecurity] = useState({ loginsToday: 0, loginsThisWeek: 0, failedLoginsWeek: 0 });
  const [services, setServices] = useState({ database: true, api: true, ml: false });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [adminData, healthData] = await Promise.all([
        apiGet('/api/admin/dashboard?days=30').catch(() => ({})),
        apiGet('/api/admin/health-status').catch(() => ({ services: {} })),
      ]);

      const usersBlock = adminData.users || {};
      const uploads = adminData.uploads || {};
      const models = adminData.models || {};
      const svc = adminData.services || healthData.services || {};

      setStats({
        totalUsers: usersBlock.totalUsers || 0,
        activeUsers: usersBlock.activeUsers || 0,
        dataUploads: uploads.totalUploads || 0,
        recentUploads: uploads.weekUploads || 0,
        aiModels: models.totalModels || 0,
        activeModels: models.activeModels || 0,
        systemHealth: adminData.systemHealth ?? 100,
        alerts: (adminData.alerts || []).length,
        userChangePct: usersBlock.changePct ?? 0,
        uploadChangePct: uploads.changePct ?? 0,
        healthChangePct: adminData.healthChangePct ?? 0,
      });

      setSecurity(adminData.security || { loginsToday: 0, loginsThisWeek: 0, failedLoginsWeek: 0 });
      setServices({
        database: svc.database?.ok ?? svc.database ?? true,
        api: svc.api?.ok ?? svc.api ?? true,
        ml: svc.ml?.ok ?? svc.ml ?? false,
      });

      setDataUploadTrend((uploads.trend || []).map((row) => ({
        day: row.label,
        uploads: row.uploads,
      })));

      setAiModels((models.models || []).map((m) => ({
        name: m.name,
        status: m.active !== false ? 'Active' : 'Inactive',
        accuracy: Number(m.accuracy || 0).toFixed(1),
      })));

      setSystemAlerts((adminData.alerts || []).map((a) => ({
        icon: a.severity === 'critical' ? AlertTriangle : CheckCircle,
        title: a.alert_type || 'System Alert',
        description: a.message || '',
        time: new Date(a.created_at).toLocaleString(),
        color: a.severity === 'critical' || a.severity === 'high' ? 'amber' : 'green',
      })));

      setRecentActivity((adminData.recentActivity || []).map((row) => ({
        id: row.id,
        action: row.action,
        type: row.entityType || 'system',
        title: row.action || 'Activity',
        description: row.entityType ? `${row.entityType} #${row.entityId || ''}` : 'System event',
        time: new Date(row.created_at).toLocaleString(),
        color: row.action?.includes('UPLOAD') ? 'green' : row.action?.includes('LOGIN') ? 'blue' : row.action?.includes('CREATE') ? 'blue' : 'purple',
      })));

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };


  const userTrend = formatTrend(stats.userChangePct);
  const uploadTrendBadge = formatTrend(stats.uploadChangePct);
  const healthTrend = formatTrend(stats.healthChangePct);

  const metrics = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      change: userTrend.change,
      trend: userTrend.trend,
      subtitle: `${stats.activeUsers} active users`,
      icon: Users,
      bgGradient: 'from-blue-500/10 to-blue-600/10',
      iconBg: 'bg-blue-500',
      to: '/admin/users',
      hint: 'View all users',
    },
    {
      title: 'Data Uploads',
      value: stats.dataUploads,
      change: uploadTrendBadge.change,
      trend: uploadTrendBadge.trend,
      subtitle: `+${stats.recentUploads} this week`,
      icon: Upload,
      bgGradient: 'from-emerald-500/10 to-emerald-600/10',
      iconBg: 'bg-emerald-500',
      to: '/admin/audit-logs?view=uploads&action=uploads',
      hint: 'View upload activity',
    },
    {
      title: 'System Health',
      value: `${stats.systemHealth}%`,
      change: healthTrend.change,
      trend: healthTrend.trend,
      subtitle: stats.systemHealth >= 90 ? 'Optimal performance' : 'Needs attention',
      icon: Activity,
      bgGradient: 'from-green-500/10 to-green-600/10',
      iconBg: 'bg-green-500',
      to: '/admin/system-settings#system-health',
      hint: 'System settings & health',
    },
    {
      title: 'Open Alerts',
      value: stats.alerts,
      change: stats.alerts > 0 ? 'Active' : 'Clear',
      trend: stats.alerts > 0 ? 'down' : 'up',
      subtitle: stats.alerts > 0 ? 'Review required' : 'All clear',
      icon: AlertTriangle,
      bgGradient: 'from-amber-500/10 to-amber-600/10',
      iconBg: 'bg-amber-500',
      to: '/admin/audit-logs',
      hint: 'View system alerts',
    },
  ];

  const filteredActivity = useMemo(() => {
    if (activityFilter === 'all') return recentActivity;
    if (activityFilter === 'uploads') {
      return recentActivity.filter((a) => a.action?.includes('UPLOAD') || a.title?.includes('UPLOAD'));
    }
    return recentActivity.filter((a) => a.action === activityFilter);
  }, [recentActivity, activityFilter]);

  const visibleActivity = filteredActivity.slice(0, 6);

  const getSecurityFilterRoute = (type) => {
    if (type === 'failed') return '/admin/audit-logs?view=failed-logins';
    return '/admin/audit-logs?view=logins';
  };

  const handleMetricClick = (to) => navigate(to);
  const handleMetricKeyDown = (e, to) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleMetricClick(to);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-neutral-100 dark:to-neutral-400 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <p className="text-gray-500 mt-2">Simple, focused operations overview</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button variant="outline" className="gap-2" onClick={fetchDashboardData}>
            <Clock className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 p-4 rounded-xl bg-gradient-to-r from-gray-50 to-blue-50/50 dark:from-neutral-900 dark:to-neutral-800 border border-gray-200 dark:border-neutral-700">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 self-center mr-2">Services</span>
        <ServiceDot ok={services.database} label="Database" />
        <ServiceDot ok={services.api} label="API Server" />
        <ServiceDot ok={services.ml} label="ML Service" />
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, idx) => {
          const Icon = metric.icon;
          const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Activity;
          return (
            <Card
              key={idx}
              role="button"
              tabIndex={0}
              aria-label={`${metric.title}: ${metric.value}. ${metric.hint}`}
              onClick={() => handleMetricClick(metric.to)}
              onKeyDown={(e) => handleMetricKeyDown(e, metric.to)}
              className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group cursor-pointer dark:bg-neutral-900 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${metric.bgGradient} opacity-50 group-hover:opacity-70 transition-opacity`} />
              <CardContent className="p-5 relative">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2.5 rounded-xl ${metric.iconBg} shadow-lg`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    metric.trend === 'up' ? 'bg-green-100 text-green-700' :
                    metric.trend === 'down' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300'
                  }`}>
                    <TrendIcon className="w-3 h-3" />
                    {metric.change}
                  </div>
                </div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{metric.title}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metric.value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{metric.subtitle}</p>
                <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                  {metric.hint}
                  <ArrowRight className="w-3 h-3" />
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b dark:border-neutral-700">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" />
              Security pulse
            </CardTitle>
            <CardDescription>Login activity (last 7 days)</CardDescription>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-3 gap-4">
            <button
            type="button"
            onClick={() => navigate(getSecurityFilterRoute('today'))}
            className="text-left text-center p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
          >
            <p className="text-2xl font-bold text-blue-600">{security.loginsToday}</p>
            <p className="text-xs text-gray-500 mt-1">Logins today</p>
          </button>
          <button
            type="button"
            onClick={() => navigate(getSecurityFilterRoute('week'))}
            className="text-left text-center p-3 rounded-xl bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-900 transition-colors"
          >
            <p className="text-2xl font-bold text-green-600">{security.loginsThisWeek}</p>
            <p className="text-xs text-gray-500 mt-1">This week</p>
          </button>
          <button
            type="button"
            onClick={() => navigate(getSecurityFilterRoute('failed'))}
            className="text-left text-center p-3 rounded-xl bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
          >
            <p className="text-2xl font-bold text-red-600">{security.failedLoginsWeek}</p>
            <p className="text-xs text-gray-500 mt-1">Failed attempts</p>
          </button>
          </CardContent>
        </Card>

      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-500" />
                Data upload activity
              </CardTitle>
              <CardDescription>Last 7 days</CardDescription>
            </div>
            <Badge className="border">
              <TrendingUp className="w-3 h-3 mr-1" />
              {uploadTrendBadge.change}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <ResponsiveContainer width="100%" height={240}>
            <RechartsBarChart data={dataUploadTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="uploads" fill="#10b981" radius={[8, 8, 0, 0]} name="Uploads" />
            </RechartsBarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-0 shadow-lg">
          <CardHeader className="border-b dark:border-neutral-700">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-500" />
                  AI model status
                </CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/ai-models')}>
                View all <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {aiModels.length === 0 ? (
              <p className="text-sm text-gray-500">No models configured.</p>
            ) : (
              aiModels.map((model, idx) => (
                <div key={idx} className="p-4 rounded-xl border dark:border-neutral-600">
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">{model.name}</span>
                    <Badge>{model.status}</Badge>
                  </div>
                  <Progress value={Number(model.accuracy)} className="h-2" />
                  <p className="text-xs text-gray-500 mt-1">{model.accuracy}% accuracy</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b dark:border-neutral-700">
            <CardTitle className="text-xl flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              System alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 max-h-80 overflow-y-auto">
            {systemAlerts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No recent alerts</p>
            ) : (
              systemAlerts.map((alert, idx) => {
                const Icon = alert.icon;
                return (
                  <div
                    key={idx}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate('/admin/audit-logs')}
                    className="flex gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer mb-2"
                  >
                    <Icon className={`w-4 h-4 mt-1 ${alert.color === 'amber' ? 'text-amber-600' : 'text-green-600'}`} />
                    <div>
                      <p className="font-semibold text-sm">{alert.title}</p>
                      <p className="text-xs text-gray-500">{alert.description}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{alert.time}</p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b dark:border-neutral-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-500" />
                Recent activity
              </CardTitle>
              <CardDescription>Filter by event type</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {['all', 'LOGIN', 'CREATE', 'UPDATE', 'uploads'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setActivityFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    activityFilter === f
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-600'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'uploads' ? 'Uploads' : f}
                </button>
              ))}
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/audit-logs')}>
                View all
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 max-h-80 overflow-y-auto">
          {filteredActivity.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No matching activity</p>
          ) : (
            <>
              {filteredActivity.length > visibleActivity.length && (
                <p className="text-xs text-gray-500 mb-3">Showing latest {visibleActivity.length} of {filteredActivity.length} events.</p>
              )}
              <div className="space-y-2">
                {visibleActivity.map((activity) => (
                  <div
                    key={activity.id || activity.time + activity.title}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate('/admin/audit-logs')}
                    className="flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer"
                  >
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      activity.color === 'green' ? 'bg-green-500' : activity.color === 'blue' ? 'bg-blue-500' : 'bg-purple-500'
                    }`} />
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{activity.title}</p>
                      <p className="text-sm text-gray-500">{activity.description}</p>
                      <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
