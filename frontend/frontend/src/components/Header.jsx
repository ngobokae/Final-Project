import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Bell, Search, FileText, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import logoSrc from '../assets/IMG_1472.PNG';
import { apiGet, apiPut, API_BASE_URL } from '../utils/api';
import { io } from 'socket.io-client';
import Toast from './ui/Toast';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState('');
  const [notifItems, setNotifItems] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const [toasts, setToasts] = useState([]);

  const lastSeenAuditKey = useMemo(() => {
    const uid = user?.id ? String(user.id) : 'anon';
    return `notifications:lastSeenAuditAt:${uid}`;
  }, [user?.id]);
  const lastSeenForecastKey = useMemo(() => {
    const uid = user?.id ? String(user.id) : 'anon';
    return `notifications:lastSeenForecastAt:${uid}`;
  }, [user?.id]);
  const readItemsKey = useMemo(() => {
    const uid = user?.id ? String(user.id) : 'anon';
    return `notifications:readItems:${uid}`;
  }, [user?.id]);

  const getReadItemMap = () => {
    try {
      const raw = localStorage.getItem(readItemsKey);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const notificationKey = (item) => `${item.type}:${item.id}`;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatRelativeTime = (d) => {
    const date = new Date(d);
    const now = new Date();
    const diffMs = now - date;
    const mins = Math.floor(diffMs / (1000 * 60));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  };

  const loadNotifications = async () => {
    if (!user?.role) return;
    setNotifLoading(true);
    setNotifError('');

    try {
      // 1) Messages: all roles have messages, so use inbox to represent "notifications"
      const msgRes = await apiGet('/api/messages?tab=inbox');
      const msgs = Array.isArray(msgRes?.messages) ? msgRes.messages : [];

      const unreadMsgs = msgs.filter((m) => !m.is_read);
      const topMsgs = unreadMsgs.length > 0 ? unreadMsgs : msgs;
      const readMap = getReadItemMap();

      const messageItems = topMsgs.slice(0, 5).map((m) => ({
        type: 'message',
        id: m.id,
        title: m.subject?.trim() ? m.subject : `Message from ${m.sender_name || m.other_name || 'User'}`,
        message: m.body || '',
        time: formatRelativeTime(m.created_at),
        route: `/${user.role}/messages`,
        isUnread: !m.is_read,
      }));

      // 1b) Admin audit logs (real): show in dropdown + count new since last seen
      let auditItems = [];
      let newAuditCount = 0;
      if (user.role === 'admin') {
        const auditRes = await apiGet('/api/audit');
        const logs = Array.isArray(auditRes?.logs) ? auditRes.logs : [];

        const lastSeen = localStorage.getItem(lastSeenAuditKey);
        const lastSeenTs = lastSeen ? new Date(lastSeen).getTime() : 0;
        newAuditCount = logs.filter((l) => {
          const t = new Date(l.created_at).getTime();
          return Number.isFinite(t) && t > lastSeenTs;
        }).length;

        auditItems = logs.slice(0, 5).map((l) => ({
          type: 'audit',
          id: l.id,
          title: `${l.action || 'ACTIVITY'} • ${l.entity_type || 'system'}`,
          message: l.user_name ? `By ${l.user_name}` : (l.details ? JSON.stringify(l.details) : ''),
          time: formatRelativeTime(l.created_at),
          route: '/admin/audit-logs',
          isUnread: !readMap[`audit:${l.id}`],
        }));
      }

      // 2) Inventory alerts: only inventory role has a dedicated alerts page in this frontend
      let alertItems = [];
      let activeAlertCount = 0;
      if (user.role === 'inventory') {
        const alertRes = await apiGet('/api/inventory/alerts?resolved=false');
        const alerts = Array.isArray(alertRes?.alerts) ? alertRes.alerts : [];
        const activeAlerts = alerts.filter((a) => !a.is_resolved);
        activeAlertCount = activeAlerts.length;
        alertItems = activeAlerts.slice(0, 5).map((a) => ({
          type: 'alert',
          id: a.id,
          title: `${String(a.severity || 'alert').toUpperCase()} inventory alert`,
          message: a.message || '',
          time: formatRelativeTime(a.created_at),
          route: '/inventory/alerts',
          isUnread: !readMap[`alert:${a.id}`],
        }));
      }

      // 3) Forecast updates for operations/executive
      let forecastItems = [];
      let newForecastCount = 0;
      if (user.role === 'operations' || user.role === 'executive') {
        const forecastRes = await apiGet('/api/forecast?days=30');
        const forecasts = Array.isArray(forecastRes?.forecasts) ? forecastRes.forecasts : [];

        const lastSeen = localStorage.getItem(lastSeenForecastKey);
        const lastSeenTs = lastSeen ? new Date(lastSeen).getTime() : 0;

        const getTs = (f) => {
          const t = new Date(f.created_at || f.updated_at || f.forecast_date).getTime();
          return Number.isFinite(t) ? t : 0;
        };

        newForecastCount = forecasts.filter((f) => getTs(f) > lastSeenTs).length;

        const sorted = forecasts
          .slice()
          .sort((a, b) => getTs(b) - getTs(a))
          .slice(0, 5);

        forecastItems = sorted.map((f, idx) => ({
          type: 'forecast',
          id: f.id || `${f.product_id || 'p'}-${idx}`,
          title: `Forecast updated • ${f.product_name || `Product #${f.product_id || '-'}`}`,
          message: `Demand ${Math.round(Number(f.forecasted_demand) || 0)} for ${new Date(f.forecast_date).toLocaleDateString()}`,
          time: formatRelativeTime(f.created_at || f.updated_at || f.forecast_date),
          route: '/operations/demand-forecast',
          isUnread: !readMap[`forecast:${f.id || `${f.product_id || 'p'}-${idx}`}`],
        }));
      }

      // Merge (alerts first for inventory), then messages
      const merged =
        user.role === 'inventory'
          ? [...alertItems, ...messageItems].slice(0, 7)
          : user.role === 'admin'
            ? [...auditItems, ...messageItems].slice(0, 7)
            : (user.role === 'operations' || user.role === 'executive')
              ? [...forecastItems, ...messageItems].slice(0, 7)
              : messageItems.slice(0, 7);

      setNotifItems(merged);
      setNotifCount(merged.filter((item) => item.isUnread).length);
    } catch (e) {
      setNotifError(e?.message || 'Failed to load notifications');
      setNotifItems([]);
      setNotifCount(0);
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    // Pre-load counts on role changes so badge is real.
    // Avoid spamming: only run when role changes.
    if (!user?.role) return;
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  useEffect(() => {
    if (!showNotifications) return;
    loadNotifications();
    // When admin opens the panel, mark audit logs as "seen"
    if (user?.role === 'admin') {
      localStorage.setItem(lastSeenAuditKey, new Date().toISOString());
    }
    if (user?.role === 'operations' || user?.role === 'executive') {
      localStorage.setItem(lastSeenForecastKey, new Date().toISOString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNotifications]);

  useEffect(() => {
    if (!user?.id) return;

    // Remove http:// or https:// from API_BASE_URL if it's there
    const socket = io(API_BASE_URL);

    socket.on('connect', () => {
      console.log('Connected to real-time server');
    });

    socket.on('new_audit', (data) => {
      // Only show toasts for important actions if not the current user
      if (data.userId !== user.id) {
        setToasts(prev => [...prev, {
          id: Date.now(),
          type: 'audit',
          message: {
            title: 'System Activity',
            description: `${data.action} by another user`
          }
        }]);
        loadNotifications();
      }
    });

    // Custom alerts from inventory or sales
    socket.on('new_notification', (data) => {
      setToasts(prev => [...prev, {
        id: Date.now(),
        type: data.severity === 'critical' || data.severity === 'high' ? 'warning' : 'info',
        message: {
          title: data.title || 'New Notification',
          description: data.message
        }
      }]);
      loadNotifications();
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.id]);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    if (!user?.role) return;

    const onNotifChanged = () => loadNotifications();
    const onForecastChanged = () => loadNotifications();
    const onToast = (e) => {
      if (e.detail) {
        setToasts(prev => [...prev, {
          id: Date.now(),
          type: e.detail.type || 'info',
          message: {
            title: e.detail.title || 'Notification',
            description: e.detail.description || ''
          }
        }]);
      }
    };
    
    window.addEventListener('app:notifications-changed', onNotifChanged);
    window.addEventListener('app:forecasts-updated', onForecastChanged);
    window.addEventListener('app:toast', onToast);

    const interval = window.setInterval(() => {
      loadNotifications();
    }, 20000);

    return () => {
      window.removeEventListener('app:notifications-changed', onNotifChanged);
      window.removeEventListener('app:forecasts-updated', onForecastChanged);
      window.removeEventListener('app:toast', onToast);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const handleNotificationItemClick = (route) => {
    setShowNotifications(false);
    if (route) navigate(route);
  };

  const handleMarkNotificationRead = async (item, event) => {
    event.stopPropagation();
    try {
      if (item.type === 'message') {
        await apiPut(`/api/messages/${item.id}/read`, {});
      }

      const current = getReadItemMap();
      current[notificationKey(item)] = new Date().toISOString();
      localStorage.setItem(readItemsKey, JSON.stringify(current));
      await loadNotifications();
      window.dispatchEvent(new Event('app:notifications-changed'));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleOpenNotification = async (item, event) => {
    event.stopPropagation();
    if (item.isUnread) {
      await handleMarkNotificationRead(item, event);
    }
    handleNotificationItemClick(item.route);
  };

  const canOpenNotification = (item) => {
    if (!item?.route || !user?.role) return false;
    return item.route.startsWith(`/${user.role}/`);
  };

  return (
    <header className="fixed top-0 right-0 left-72 h-16 bg-white dark:bg-neutral-950/90 border-b border-gray-200 dark:border-neutral-700 z-30 flex items-center justify-between px-6">
      <div className="flex items-center gap-4 flex-1">
        <img
          src={logoSrc}
          alt="Kinglion"
          className="h-7 w-auto max-w-[120px] object-contain mr-2"
        />

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/60 bg-white text-gray-900 placeholder-gray-500 dark:border-neutral-600 dark:bg-neutral-900 dark:text-gray-100 dark:placeholder-neutral-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setShowNotifications((prev) => !prev)}
            className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-400 dark:hover:text-white dark:hover:bg-neutral-800"
            title="Open notifications"
          >
            <Bell className="w-5 h-5" />
            {notifCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 bg-red-600 text-white text-[11px] font-bold rounded-full flex items-center justify-center shadow-sm"
                aria-label={`${notifCount} notifications`}
              >
                {notifCount > 99 ? '99+' : notifCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-12 w-96 max-w-[90vw] rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-black/10 dark:border-neutral-800 dark:bg-neutral-950 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800 bg-gradient-to-r from-neutral-950/5 to-red-50 dark:from-neutral-900 dark:to-neutral-900">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Notifications</p>
                  <p className="text-xs text-gray-500 dark:text-neutral-400 capitalize">
                    {user?.role || 'user'} updates
                  </p>
                </div>
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-neutral-900 to-red-800 text-white">
                  {notifCount}
                </span>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {notifLoading ? (
                  <div className="px-4 py-6 text-sm text-gray-500 dark:text-neutral-400">
                    Loading notifications...
                  </div>
                ) : notifError ? (
                  <div className="px-4 py-6 text-sm text-red-700 dark:text-red-400">
                    {notifError}
                  </div>
                ) : notifItems.length > 0 ? (
                  notifItems.map((item, index) => (
                    <button
                      key={`${item.title}-${index}`}
                      onClick={(e) => {
                        if (canOpenNotification(item)) {
                          handleOpenNotification(item, e);
                        } else {
                          handleMarkNotificationRead(item, e);
                        }
                      }}
                      className="w-full text-left px-4 py-3 border-b border-gray-100 dark:border-neutral-800 hover:bg-red-50/70 dark:hover:bg-neutral-900 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={
                            "mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 " +
                            (item.type === 'alert'
                              ? 'bg-gradient-to-r from-red-700 to-red-500'
                              : item.type === 'forecast'
                                ? 'bg-gradient-to-r from-indigo-700 to-blue-500'
                                : 'bg-gradient-to-r from-neutral-900 to-red-700')
                          }
                        ></div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
                            {item.title}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">
                            {item.message}
                          </p>
                          <p className="text-xs text-red-700 dark:text-red-400 mt-2 font-medium">
                            {item.time}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            {canOpenNotification(item) && (
                              <button
                                onClick={(e) => handleOpenNotification(item, e)}
                                className="text-xs px-2 py-1 rounded-md border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                              >
                                Open
                              </button>
                            )}
                            <button
                              onClick={(e) => handleMarkNotificationRead(item, e)}
                              className="text-xs px-2 py-1 rounded-md border border-red-200 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-neutral-800"
                            >
                              Read
                            </button>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-6 text-sm text-gray-500 dark:text-neutral-400">
                    No notifications available for this role.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border border-gray-200 dark:bg-neutral-900 dark:border-neutral-800 rounded-lg">
          <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-gray-900 dark:text-neutral-100">{user?.name || 'User'}</p>
            <p className="text-xs text-gray-500 dark:text-neutral-400 capitalize">{user?.role || 'Role'}</p>
          </div>
        </div>

        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="w-5 h-5" />
        </Button>
      </div>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          type={toast.type}
          message={toast.message}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </header>
  );
}
