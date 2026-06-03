import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Button } from '../../components/ui/button';
import {
  Users, Upload, Brain, Activity, AlertTriangle, CheckCircle, TrendingUp, TrendingDown,
  ArrowRight, Server, Database, Clock, UserPlus, FileText, Settings, Shield, Zap,
  Circle, Key, Laptop, Globe
} from 'lucide-react';
import {
  AreaChart, Area, BarChart as RechartsBarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { apiGet, apiDelete, API_BASE_URL } from '../../utils/api';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { SkeletonStatCard, SkeletonCard, Skeleton } from '../../components/ui/skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { getGridProps, getAxisProps, getTooltipProps, CHART_COLORS } from '../../utils/chartStyles';

const TIME_RANGES = [
  { id: '1d', label: '24h', days: 1 },
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
];

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
  const [timeRange, setTimeRange] = useState('30d');
  const [activityFilter, setActivityFilter] = useState('all');
  const [stats, setStats] = useState({
    totalUsers: 0, activeUsers: 0, dataUploads: 0, recentUploads: 0,
    aiModels: 0, activeModels: 0, systemHealth: 100, alerts: 0,
    userChangePct: 0, uploadChangePct: 0, healthChangePct: 0,
  });
  const [loading, setLoading] = useState(true);
  const [userGrowthData, setUserGrowthData] = useState([]);
  const [roleDistribution, setRoleDistribution] = useState([]);
  const [dataUploadTrend, setDataUploadTrend] = useState([]);
  const [aiModels, setAiModels] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [usersNeedingAttention, setUsersNeedingAttention] = useState([]);
  const [security, setSecurity] = useState({ loginsToday: 0, loginsThisWeek: 0, failedLoginsWeek: 0 });
  const [services, setServices] = useState({ database: true, api: true, ml: false });
  const [activeSessions, setActiveSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const days = TIME_RANGES.find((t) => t.id === timeRange)?.days || 30;

      const [adminData, healthData, sessionsData] = await Promise.all([
        apiGet(`/api/admin/dashboard?days=${days}`).catch(() => ({})),
        apiGet('/api/admin/health-status').catch(() => ({ services: {} })),
        apiGet('/api/admin/sessions').catch(() => ({ success: false, sessions: [] })),
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

      setUserGrowthData(usersBlock.growth?.length ? usersBlock.growth : []);
      setRoleDistribution(usersBlock.roleDistribution || []);
      setUsersNeedingAttention(usersBlock.needingAttention || []);
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
        color: m.active !== false ? 'green' : 'gray',
      })));

      setSystemAlerts((adminData.alerts || []).map((a) => ({
        icon: a.severity === 'critical' ? AlertTriangle : CheckCircle,
        title: a.alert_type || 'System Alert',
        description: a.message || '',
        time: new Date(a.created_at).toLocaleString(),
        severity: a.severity,
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

      if (sessionsData && sessionsData.success) {
        setActiveSessions(sessionsData.sessions || []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to revoke this user session? The user will be logged out immediately.')) {
      return;
    }
    try {
      setSessionsLoading(true);
      const res = await apiDelete(`/api/admin/sessions/${sessionId}`);
      if (res.success) {
        const refreshed = await apiGet('/api/admin/sessions');
        if (refreshed.success) {
          setActiveSessions(refreshed.sessions || []);
        }
      }
    } catch (e) {
      alert(e.message || 'Failed to revoke session');
    } finally {
      setSessionsLoading(false);
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
      accent: 'info',
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
      accent: 'success',
      to: '/admin/audit-logs?view=uploads',
      hint: 'View upload activity',
    },
    {
      title: 'AI Models',
      value: stats.aiModels,
      change: 'Stable',
      trend: 'neutral',
      subtitle: `${stats.activeModels} actively running`,
      icon: Brain,
      accent: 'brand',
      to: '/admin/ai-models',
      hint: 'Manage AI models',
    },
    {
      title: 'System Health',
      value: `${stats.systemHealth}%`,
      change: healthTrend.change,
      trend: healthTrend.trend,
      subtitle: stats.systemHealth >= 90 ? 'Optimal performance' : 'Needs attention',
      icon: Activity,
      accent: stats.systemHealth >= 90 ? 'success' : 'warning',
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
      accent: stats.alerts > 0 ? 'warning' : 'success',
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

  const handleExportDb = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/db-export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Export failed');
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kinglion-db-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.message || 'Failed to export database');
    }
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
      <div className="space-y-8" aria-busy="true" aria-label="Loading dashboard">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Skeleton className="h-9 w-64" />
            <Skeleton className="mt-2 h-4 w-80" />
          </div>
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonStatCard key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <SkeletonCard className="lg:col-span-2" />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Admin Dashboard"
        description="System overview and management center"
        actions={
          <>
            <div className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-neutral-700">
              {TIME_RANGES.map((tr) => (
                <button
                  key={tr.id}
                  type="button"
                  onClick={() => setTimeRange(tr.id)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    timeRange === tr.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-neutral-900 dark:text-gray-400 dark:hover:bg-neutral-800'
                  }`}
                >
                  {tr.label}
                </button>
              ))}
            </div>
            <Button variant="outline" className="gap-2" onClick={fetchDashboardData}>
              <Clock className="w-4 h-4" />
              Refresh
            </Button>
            <Button onClick={() => navigate('/admin/audit-logs')}>
              <Server className="w-4 h-4 mr-2" />
              System Report
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-3 p-4 rounded-xl bg-gradient-to-r from-gray-50 to-red-50/40 dark:from-neutral-900 dark:to-neutral-800 border border-gray-200 dark:border-neutral-700">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 self-center mr-2">Services</span>
        <ServiceDot ok={services.database} label="Database" />
        <ServiceDot ok={services.api} label="API Server" />
        <ServiceDot ok={services.ml} label="ML Service" />
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 self-center mr-1">Quick actions</span>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/admin/users', { state: { openCreate: true } })}>
          <UserPlus className="w-4 h-4" /> Add user
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportDb}>
          <Database className="w-4 h-4" /> Export DB
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/admin/audit-logs')}>
          <FileText className="w-4 h-4" /> Audit logs
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/admin/ai-models')}>
          <Brain className="w-4 h-4" /> AI models
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/admin/system-settings')}>
          <Settings className="w-4 h-4" /> Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {metrics.map((metric, idx) => (
          <StatCard
            key={idx}
            title={metric.title}
            value={metric.value}
            icon={metric.icon}
            trend={metric.trend}
            change={metric.change}
            subtitle={metric.subtitle}
            hint={metric.hint}
            accent={metric.accent}
            onClick={() => handleMetricClick(metric.to)}
          />
        ))}
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
            <div className="text-center p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30">
              <p className="text-2xl font-bold text-blue-600">{security.loginsToday}</p>
              <p className="text-xs text-gray-500 mt-1">Logins today</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-green-50 dark:bg-green-950/30">
              <p className="text-2xl font-bold text-green-600">{security.loginsThisWeek}</p>
              <p className="text-xs text-gray-500 mt-1">This week</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-red-50 dark:bg-red-950/30">
              <p className="text-2xl font-bold text-red-600">{security.failedLoginsWeek}</p>
              <p className="text-xs text-gray-500 mt-1">Failed attempts</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-0 shadow-lg">
          <CardHeader className="border-b dark:border-neutral-700 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-500" />
                Users needing attention
              </CardTitle>
              <CardDescription>Inactive, no 2FA, or stale logins</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/users')}>Manage</Button>
          </CardHeader>
          <CardContent className="p-4 max-h-48 overflow-y-auto">
            {usersNeedingAttention.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">All users look good.</p>
            ) : (
              <ul className="space-y-2">
                {usersNeedingAttention.map((u) => (
                  <li
                    key={u.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/admin/users?highlight=${u.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/users?highlight=${u.id}`)}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer text-sm"
                  >
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end max-w-[50%]">
                      {u.reasons?.map((r) => (
                        <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-lg lg:col-span-2">
          <CardHeader className="border-b dark:border-neutral-700">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  User growth
                </CardTitle>
                <CardDescription>Cumulative users (6 months)</CardDescription>
              </div>
              <Badge className="border">
                <TrendingUp className="w-3 h-3 mr-1" />
                {userTrend.change}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {userGrowthData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={userGrowthData}>
                  <CartesianGrid {...getGridProps()} />
                  <XAxis dataKey="month" {...getAxisProps()} />
                  <YAxis {...getAxisProps()} />
                  <Tooltip {...getTooltipProps()} />
                  <Legend />
                  <Area type="monotone" dataKey="users" stroke={CHART_COLORS[4]} fill={CHART_COLORS[4]} fillOpacity={0.2} name="Total" />
                  <Area type="monotone" dataKey="active" stroke={CHART_COLORS[2]} fill={CHART_COLORS[2]} fillOpacity={0.15} name="Active est." />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                compact
                icon={Users}
                title="No growth data yet"
                description="User growth will appear here once accounts are created over time."
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b dark:border-neutral-700">
            <CardTitle className="text-xl flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              Users by role
            </CardTitle>
            <CardDescription>Click a segment to filter users</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {roleDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={roleDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    onClick={(data) => data?.role && navigate(`/admin/users?role=${data.role}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {roleDistribution.map((entry, idx) => (
                      <Cell key={entry.role} fill={entry.color || CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...getTooltipProps()} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                compact
                icon={Users}
                title="No users"
                description="Role distribution will appear once users are added."
              />
            )}
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
          {dataUploadTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <RechartsBarChart data={dataUploadTrend}>
                <CartesianGrid {...getGridProps()} />
                <XAxis dataKey="day" {...getAxisProps()} />
                <YAxis {...getAxisProps()} />
                <Tooltip {...getTooltipProps()} cursor={{ fill: 'rgba(120,120,120,0.08)' }} />
                <Bar dataKey="uploads" fill={CHART_COLORS[2]} radius={[8, 8, 0, 0]} name="Uploads" />
              </RechartsBarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              compact
              icon={Upload}
              title="No upload activity"
              description="Data uploads from the last 7 days will appear here."
            />
          )}
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
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-800'
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
        <CardContent className="p-6">
          {filteredActivity.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No matching activity</p>
          ) : (
            <div className="space-y-2">
              {filteredActivity.map((activity) => (
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
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b dark:border-neutral-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Key className="w-5 h-5 text-red-500" />
              Active User Sessions & Control
            </CardTitle>
            <CardDescription>Monitor logged-in sessions and revoke access instantly if needed.</CardDescription>
          </div>
          {sessionsLoading && (
            <Badge variant="outline" className="animate-pulse bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">
              Updating...
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {activeSessions.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">No active sessions found.</p>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="p-4 pl-6">User / Role</th>
                  <th className="p-4">Device</th>
                  <th className="p-4">IP Address</th>
                  <th className="p-4">Last Active</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {activeSessions.map((session) => {
                  const roleColors = {
                    admin: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400',
                    operations: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400',
                    inventory: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400',
                    executive: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400'
                  };
                  const roleColor = roleColors[session.userRole] || 'bg-gray-100 text-gray-700 border-gray-200';
                  
                  return (
                    <tr key={session.id} className="hover:bg-gray-50/50 dark:hover:bg-neutral-900/50 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            {session.userName}
                            {session.current && (
                              <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded">You</Badge>
                            )}
                          </span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-xs text-gray-500">{session.userEmail}</span>
                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded border ${roleColor}`}>
                              {session.userRole}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-700 dark:text-gray-300">
                        <div className="flex items-center gap-2">
                          <Laptop className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="truncate max-w-[200px]">{session.device || 'Unknown Browser'}</span>
                        </div>
                      </td>
                      <td className="p-4 text-gray-700 dark:text-gray-300 font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                          <span>{session.ip || 'Localhost'}</span>
                        </div>
                      </td>
                      <td className="p-4 text-xs text-gray-500">
                        {new Date(session.lastActive).toLocaleString()}
                      </td>
                      <td className="p-4 pr-6 text-right">
                        {session.current ? (
                          <span className="text-xs text-gray-400 italic font-medium">Active Session</span>
                        ) : (
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={sessionsLoading}
                            onClick={() => handleRevokeSession(session.id)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/30 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-900 hover:text-red-700 text-xs px-2.5 py-1 rounded"
                          >
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
