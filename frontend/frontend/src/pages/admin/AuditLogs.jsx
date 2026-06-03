import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Search, Filter, Download, User, Clock, Activity } from 'lucide-react';

const isUploadRelatedLog = (log) => {
  const action = (log.action || '').toUpperCase();
  const entity = (log.entity_type || '').toLowerCase();
  const details = JSON.stringify(log.details || {}).toLowerCase();
  return (
    action.includes('UPLOAD') ||
    entity.includes('sale') ||
    entity.includes('upload') ||
    entity.includes('forecast') ||
    entity.includes('import') ||
    details.includes('upload') ||
    details.includes('csv') ||
    details.includes('file')
  );
};

export default function AuditLogs() {
  const [searchParams] = useSearchParams();
  const uploadsView = searchParams.get('view') === 'uploads';
  const failedLoginsView = searchParams.get('view') === 'failed-logins';
  const loginsView = searchParams.get('view') === 'logins';

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState(
    uploadsView ? 'uploads' : failedLoginsView ? 'LOGIN_FAILED' : loginsView ? 'LOGIN' : 'all'
  );

  useEffect(() => {
    fetchLogs();
  }, [uploadsView, failedLoginsView, loginsView]);

  useEffect(() => {
    if (uploadsView) {
      setFilterAction('uploads');
    } else if (failedLoginsView) {
      setFilterAction('LOGIN_FAILED');
    } else if (loginsView) {
      setFilterAction('LOGIN');
    }
  }, [uploadsView, failedLoginsView, loginsView]);

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.set('limit', uploadsView ? '100' : '50');
      if (uploadsView) {
        params.set('action', 'uploads');
      } else if (failedLoginsView) {
        params.set('action', 'LOGIN_FAILED');
      }

      const response = await fetch(`http://localhost:3001/api/audit?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      } else {
        // Use sample data if API fails
        setLogs(getSampleLogs());
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      setLogs(getSampleLogs());
    } finally {
      setLoading(false);
    }
  };

  const getSampleLogs = () => [
    { id: 1, user_name: 'Admin User', action: 'LOGIN', entity_type: 'auth', details: { ip: '192.168.1.1' }, created_at: new Date().toISOString() },
    { id: 2, user_name: 'Operations Manager', action: 'CREATE', entity_type: 'product', details: { product: 'Widget A' }, created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 3, user_name: 'Inventory Manager', action: 'UPDATE', entity_type: 'inventory', details: { product: 'Component B', quantity: 150 }, created_at: new Date(Date.now() - 7200000).toISOString() },
    { id: 4, user_name: 'Admin User', action: 'DELETE', entity_type: 'user', details: { user: 'test@example.com' }, created_at: new Date(Date.now() - 10800000).toISOString() },
    { id: 5, user_name: 'Executive', action: 'VIEW', entity_type: 'report', details: { report: 'Monthly Sales' }, created_at: new Date(Date.now() - 14400000).toISOString() },
  ];

  const getActionBadge = (action) => {
    const colors = {
      LOGIN: 'bg-blue-100 text-blue-800 border-blue-200',
      LOGOUT: 'bg-gray-100 text-gray-800 border-gray-200',
      CREATE: 'bg-green-100 text-green-800 border-green-200',
      UPDATE: 'bg-amber-100 text-amber-800 border-amber-200',
      DELETE: 'bg-red-100 text-red-800 border-red-200',
      VIEW: 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return colors[action] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_type?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterAction === 'all' ||
      (filterAction === 'uploads'
        ? isUploadRelatedLog(log)
        : filterAction === 'LOGIN_FAILED'
        ? log.action === 'LOGIN_FAILED'
        : filterAction === 'LOGIN'
        ? log.action === 'LOGIN' || log.action === 'LOGIN_2FA' || log.action === 'LOGIN_FAILED'
        : log.action === filterAction);
    return matchesSearch && matchesFilter;
  });

  const exportLogs = () => {
    const csv = [
      ['Date', 'User', 'Action', 'Entity Type', 'Details'],
      ...filteredLogs.map(log => [
        new Date(log.created_at).toLocaleString(),
        log.user_name,
        log.action,
        log.entity_type,
        JSON.stringify(log.details)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600" />
            Audit Logs
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {uploadsView
              ? 'Upload and import activity across the system'
              : failedLoginsView
              ? 'Failed login attempts from the last 7 days'
              : loginsView
              ? 'Login activity and access events'
              : 'Track all system activities and changes'}
          </p>
        </div>
        <button
          onClick={exportLogs}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
        >
          <Download className="w-5 h-5" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white dark:bg-neutral-900"
          >
            <option value="all">All Actions</option>
            <option value="uploads">Data uploads</option>
            <option value="UPLOAD">Upload</option>
            <option value="LOGIN">Login</option>
            <option value="LOGOUT">Logout</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="VIEW">View</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Events</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{logs.length}</div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
          <div className="text-sm text-gray-500">Logins Today</div>
          <div className="text-2xl font-bold text-blue-600">
            {logs.filter(l => l.action === 'LOGIN' && new Date(l.created_at).toDateString() === new Date().toDateString()).length}
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
          <div className="text-sm text-gray-500">Changes Today</div>
          <div className="text-2xl font-bold text-amber-600">
            {logs.filter(l => ['CREATE', 'UPDATE', 'DELETE'].includes(l.action) && new Date(l.created_at).toDateString() === new Date().toDateString()).length}
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
          <div className="text-sm text-gray-500">Active Users</div>
          <div className="text-2xl font-bold text-green-600">
            {new Set(logs.map(l => l.user_name)).size}
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-200 dark:border-neutral-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Action</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                        {log.user_name?.charAt(0).toUpperCase() || 'S'}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{log.user_name || 'System'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getActionBadge(log.action)}`}>
                      <Activity className="w-3 h-3" />
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">{log.entity_type}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-500 font-mono">
                      {JSON.stringify(log.details || {}).substring(0, 50)}
                      {JSON.stringify(log.details || {}).length > 50 ? '...' : ''}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No audit logs found
          </div>
        )}
      </div>
    </div>
  );
}
