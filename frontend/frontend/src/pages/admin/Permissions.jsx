import { useEffect, useState } from 'react';
import { ShieldCheck, Users, Lock, CheckSquare, Square, Loader2 } from 'lucide-react';

const ROLE_DEFAULTS = {
  admin: {
    dashboard: ['view'],
    users: ['view', 'create', 'edit', 'delete'],
    products: ['view', 'create', 'edit', 'delete'],
    sales: ['view', 'create', 'edit', 'delete'],
    inventory: ['view', 'create', 'edit', 'delete'],
    forecasts: ['view', 'create', 'edit', 'delete'],
    reports: ['view', 'export'],
    settings: ['view', 'edit'],
  },
  operations: {
    dashboard: ['view'],
    products: ['view', 'create', 'edit', 'delete'],
    sales: ['view', 'create', 'edit', 'delete'],
    inventory: ['view', 'create', 'edit', 'delete'],
    forecasts: ['view', 'create', 'edit', 'delete'],
    reports: ['view', 'export'],
  },
  inventory: {
    dashboard: ['view'],
    products: ['view'],
    sales: ['view'],
    inventory: ['view', 'create', 'edit'],
    forecasts: ['view'],
    reports: ['view'],
  },
  executive: {
    dashboard: ['view'],
    products: ['view'],
    sales: ['view'],
    inventory: ['view'],
    forecasts: ['view'],
    reports: ['view', 'export'],
  },
};

const RESOURCES = [
  { key: 'dashboard', label: 'Dashboard', actions: ['view'] },
  { key: 'users', label: 'Users', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'products', label: 'Products', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'sales', label: 'Sales', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'inventory', label: 'Inventory', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'forecasts', label: 'Forecasts', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'reports', label: 'Reports & KPIs', actions: ['view', 'export'] },
  { key: 'settings', label: 'System Settings', actions: ['view', 'edit'] },
];

// Only show resources that are relevant for a given role (have defaults)
const getResourcesForRole = (role) => {
  const defaults = ROLE_DEFAULTS[role] || {};
  return RESOURCES.filter(({ key }) => Array.isArray(defaults[key]));
};

export default function PermissionsPage() {
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const loadUserPermissions = async (user) => {
    setSelectedUser(user);
    setLoadingPerms(true);
    setStatusMessage(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/users/${user.id}/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let overrides = {};
      if (response.ok) {
        const data = await response.json();
        overrides = data.permissions || {};
      }

      const roleDefaults = ROLE_DEFAULTS[user.role] || {};
      const resourcesForRole = getResourcesForRole(user.role);
      const effectivePerms = {};

      resourcesForRole.forEach(({ key, actions }) => {
        const explicit = overrides[key];
        const base = roleDefaults[key] || [];
        const source = Array.isArray(explicit) ? explicit : base;
        effectivePerms[key] = actions.filter((action) => source.includes(action));
      });

      setPermissions(effectivePerms);
    } catch (error) {
      console.error('Failed to load user permissions:', error);
      setPermissions({});
    } finally {
      setLoadingPerms(false);
    }
  };

  const togglePermission = (resource, action) => {
    setPermissions((prev) => {
      const current = prev[resource] || [];
      const exists = current.includes(action);
      const next = exists ? current.filter((a) => a !== action) : [...current, action];
      return { ...prev, [resource]: next };
    });
  };

  const setAllForResource = (resource, enable) => {
    setPermissions((prev) => {
      const actions = RESOURCES.find((r) => r.key === resource)?.actions || [];
      return { ...prev, [resource]: enable ? [...actions] : [] };
    });
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    setStatusMessage(null);

    try {
      const token = localStorage.getItem('token');
      const payload = {};
      const resourcesForRole = getResourcesForRole(selectedUser.role);

      resourcesForRole.forEach(({ key }) => {
        payload[key] = permissions[key] || [];
      });

      const response = await fetch(`http://localhost:3001/api/users/${selectedUser.id}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ permissions: payload }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save permissions');
      }

      setStatusMessage({ type: 'success', text: 'Permissions updated successfully.' });
    } catch (error) {
      console.error('Failed to save permissions:', error);
      setStatusMessage({ type: 'error', text: error.message || 'Failed to save permissions.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-blue-600" />
            Roles & Permissions
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Enable or disable module permissions for each user.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Users list */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-neutral-600 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Users</h2>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {usersLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading users...
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No users found</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {users.map((user) => {
                    const isActive = selectedUser?.id === user.id;
                    return (
                      <li
                        key={user.id}
                        className={`px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-50 dark:hover:bg-neutral-800 ${
                          isActive ? 'bg-blue-50 dark:bg-neutral-800' : ''
                        }`}
                        onClick={() => loadUserPermissions(user)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                            {user.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-neutral-600">
                          {user.role}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Permissions editor */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedUser ? (
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-dashed border-gray-300 dark:border-neutral-600 p-8 flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400">
              <Lock className="w-10 h-10 text-gray-400 mb-3" />
              <p className="text-sm font-medium">Select a user on the left to manage permissions.</p>
            </div>
          ) : (
            <>
              <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Managing permissions for</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedUser.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-neutral-600">
                      Role: {selectedUser.role}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving || loadingPerms}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-4 h-4" />
                        Save Permissions
                      </>
                    )}
                  </button>
                </div>
              </div>

              {statusMessage && (
                <div
                  className={`text-sm px-4 py-2 rounded-lg ${
                    statusMessage.type === 'success'
                      ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                  }`}
                >
                  {statusMessage.text}
                </div>
              )}

              <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
                {loadingPerms ? (
                  <div className="flex items-center justify-center h-48 text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    Loading permissions...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getResourcesForRole(selectedUser.role).map(({ key, label, actions }) => (
                      <div
                        key={key}
                        className="border border-gray-200 rounded-lg p-4 bg-gray-50 dark:bg-neutral-800/60"
                      >
                        <div className="flex items-center justify-between mb-3">
                            <div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{key}</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setAllForResource(key, true)}
                              className="text-xs px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/50"
                            >
                              Enable all
                            </button>
                            <button
                              onClick={() => setAllForResource(key, false)}
                              className="text-xs px-2 py-1 rounded-full bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50"
                            >
                              Disable all
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {actions.map((action) => {
                            const enabled = permissions[key]?.includes(action);
                            const Icon = enabled ? CheckSquare : Square;
                            return (
                              <button
                                key={action}
                                type="button"
                                onClick={() => togglePermission(key, action)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm border transition-colors ${
                                  enabled
                                    ? 'bg-blue-50 dark:bg-neutral-800 border-blue-200 dark:border-neutral-600 text-blue-700 dark:text-neutral-200'
                                    : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                                }`}
                              >
                                <span className="capitalize">{action}</span>
                                <Icon className="w-4 h-4" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

