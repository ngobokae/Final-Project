import { useState, useEffect } from 'react';
import { Settings, Save, Bell, Database, Globe, RefreshCw, Wand2, Download, Activity, Shield, Sparkles } from 'lucide-react';

export default function SystemSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (!loading && window.location.hash === '#system-health') {
      document.getElementById('system-health')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading]);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Convert to simple key-value format
        const settingsObj = {};
        Object.entries(data.settings || {}).forEach(([key, val]) => {
          settingsObj[key] = val.value;
        });
        setSettings(settingsObj);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      // Use defaults if API fails
      setSettings({
        site_name: 'Kinglion',
        timezone: 'UTC',
        language: 'en',
        email_notifications: true,
        alert_threshold: 'medium',
        data_retention_days: 90,
        auto_backup: true,
        backup_frequency: 'daily',
        maintenance_mode: false
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ settings })
      });
      
      if (response.ok) {
        // Persist site name for all roles and update tab title immediately
        try {
          if (settings.site_name) {
            localStorage.setItem('site_name', settings.site_name);
            window.dispatchEvent(new CustomEvent('app:site-name-changed'));
          }
        } catch (_) {}
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadDbBackup = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/admin/db-export', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to export database.');
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kinglion-db-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('DB export download failed', e);
      alert(e?.message || 'Failed to download database backup.');
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Settings className="w-7 h-7 text-blue-600" />
            System Settings
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Configure system-wide settings and preferences</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {saved && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg">
          Settings saved successfully!
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl border-0 p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-6">
            <Globe className="w-5 h-5 text-blue-600" />
            Global ERP Identity
          </h2>
          <div className="space-y-6 relative">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Global Brand Name</label>
              <input
                type="text"
                placeholder="e.g. Kinglion Rwanda ERP"
                value={settings.site_name || ''}
                onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-neutral-800 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-lg"
              />
              <p className="text-[10px] text-gray-400 mt-2 italic">This name will appear across all role-based dashboards and reports.</p>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Strategic Mission</label>
              <textarea
                placeholder="Enter the core objective for AI optimization..."
                value={settings.strategic_mission || 'Optimize supply chain resilience and maximize revenue through AI-driven demand forecasting.'}
                onChange={(e) => setSettings({ ...settings, strategic_mission: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-neutral-800 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-sm min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Primary Language</label>
                <select
                  value={settings.language || 'en'}
                  onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-neutral-800 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-sm font-bold"
                >
                  <option value="en">English (Default)</option>
                  <option value="fr">French</option>
                  <option value="rw">Kinyarwanda</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Regional Timezone</label>
                <select
                  value={settings.timezone || 'Africa/Kigali'}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-neutral-800 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-sm font-bold"
                >
                  <option value="Africa/Kigali">Kigali (GMT+2)</option>
                  <option value="UTC">UTC</option>
                  <option value="Europe/London">London (GMT+0)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-blue-600" />
            Notifications
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Email Notifications</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Receive alerts via email</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.email_notifications === true || settings.email_notifications === 'true'}
                  onChange={(e) => setSettings({ ...settings, email_notifications: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alert Threshold</label>
              <select
                value={settings.alert_threshold || 'medium'}
                onChange={(e) => setSettings({ ...settings, alert_threshold: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
              >
                <option value="low">Low - All alerts</option>
                <option value="medium">Medium - Important alerts only</option>
                <option value="high">High - Critical alerts only</option>
              </select>
            </div>

          </div>
        </div>

        {/* Data Management / System Health */}
        <div
          id="system-health"
          className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6 scroll-mt-24 ring-2 ring-transparent [&:target]:ring-green-500/40 transition-shadow"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-green-600" />
            System Health & Data Management
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 -mt-2">
            Backups, retention, and database maintenance
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Retention (days)</label>
              <input
                type="number"
                value={settings.data_retention_days || 90}
                onChange={(e) => setSettings({ ...settings, data_retention_days: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Auto Backup</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Automatically backup data</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.auto_backup === true || settings.auto_backup === 'true'}
                  onChange={(e) => setSettings({ ...settings, auto_backup: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Backup Frequency</label>
              <select
                value={settings.backup_frequency || 'daily'}
                onChange={(e) => setSettings({ ...settings, backup_frequency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            <button
              onClick={handleDownloadDbBackup}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-neutral-950 via-neutral-900 to-red-800 text-white hover:opacity-95 transition-opacity"
            >
              <Download className="w-4 h-4" />
              Download full database backup (JSON)
            </button>
          </div>
        </div>

        {/* System Features */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
            <Wand2 className="w-5 h-5 text-blue-600" />
            System Features
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Live Dashboard Refresh</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Auto-refresh dashboard widgets for all users</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.live_dashboard_refresh === true || settings.live_dashboard_refresh === 'true'}
                  onChange={(e) => setSettings({ ...settings, live_dashboard_refresh: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Workflow Auto Sync</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Sync Procurement, Production, and Inventory statuses automatically</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.workflow_auto_sync === true || settings.workflow_auto_sync === 'true'}
                  onChange={(e) => setSettings({ ...settings, workflow_auto_sync: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Smart Insights Assistant</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Enable AI-generated suggestions in operations and executive views</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.smart_insights_assistant === true || settings.smart_insights_assistant === 'true'}
                  onChange={(e) => setSettings({ ...settings, smart_insights_assistant: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/40 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" /> Real-time metrics
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/40 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" /> Workflow protection
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/40 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" /> AI assistance
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
