import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, CheckCircle, Clock, Filter, RefreshCw, Package, Zap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { formatCurrency } from '../../utils/currency';

export default function Alerts() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlert, setSelectedAlert] = useState(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/inventory/alerts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const fetchedAlerts = data.alerts || [];
        setAlerts(fetchedAlerts);
      } else {
        setAlerts([]);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };


  const resolveAlert = async (alertId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/inventory/alerts/${alertId}/resolve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        await fetchAlerts(); // Refresh alerts
        window.dispatchEvent(new Event('app:notifications-changed'));
      } else {
        alert('Failed to resolve alert. Please try again.');
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      alert('Failed to resolve alert. Please try again.');
    }
  };

  const handleOrderImmediately = async (alertItem) => {
    const productId = alertItem.product_id ?? alertItem.productId ?? '';
    const available = Number(alertItem.available_stock ?? alertItem.current_stock ?? 0);
    const reorderPoint = Number(alertItem.reorder_point || 100);
    const suggestedQty = Math.max(1, reorderPoint - available);
    const params = new URLSearchParams({
      product_id: String(productId),
      transaction_type: 'ordered',
      quantity: String(suggestedQty),
      notes: `Ordered from alert #${alertItem.id} (${alertItem.severity})`,
      product_name: String(alertItem.product_name || ''),
      sku: String(alertItem.sku || '')
    });
    navigate(`/inventory/stock-transactions?${params.toString()}`);
  };

  const getSeverityStyle = (severity) => {
    const styles = {
      critical: { bg: 'bg-red-50 border-red-200 border-l-4 border-l-red-500', icon: 'bg-red-100 text-red-600', badge: 'bg-red-100 text-red-800' },
      high: { bg: 'bg-orange-50 border-orange-200', icon: 'bg-orange-100 text-orange-600', badge: 'bg-orange-100 text-orange-800' },
      medium: { bg: 'bg-amber-50 border-amber-200', icon: 'bg-amber-100 text-amber-600', badge: 'bg-amber-100 text-amber-800' },
      low: { bg: 'bg-blue-50 border-blue-200', icon: 'bg-blue-100 text-blue-600', badge: 'bg-blue-100 text-blue-800' },
      info: { bg: 'bg-gray-50 dark:bg-neutral-800 dark:border-neutral-600 border-gray-200', icon: 'bg-gray-100 text-gray-600', badge: 'bg-gray-100 text-gray-800' }
    };
    return styles[severity] || styles.low;
  };

  const getAlertTypeIcon = (type) => {
    switch (type) {
      case 'shortage': return AlertTriangle;
      case 'overstock': return Package;
      case 'reorder': return Bell;
      case 'forecast_anomaly': return Clock;
      default: return AlertTriangle;
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = 
      alert.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === 'all') return matchesSearch;
    if (filter === 'active') return !alert.is_resolved && matchesSearch;
    if (filter === 'resolved') return alert.is_resolved && matchesSearch;
    return alert.severity === filter && matchesSearch;
  });

  const activeAlerts = alerts.filter(a => !a.is_resolved);
  const stats = {
    total: alerts.length,
    active: activeAlerts.length,
    critical: alerts.filter(a => a.severity === 'critical' && !a.is_resolved).length,
    warnings: alerts.filter(a => a.severity === 'high' && !a.is_resolved).length,
    info: alerts.filter(a => a.severity === 'low' && !a.is_resolved).length,
    resolved: alerts.filter(a => a.is_resolved).length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-7 h-7 text-purple-600" />
            Alerts
          </h1>
          <p className="text-gray-500 mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* Section Title */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Inventory Alerts</h2>
        <p className="text-gray-500 mt-1">Monitor critical inventory issues and take action.</p>
      </div>

      {/* Alert Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4 cursor-pointer hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Active Alerts</div>
              <div className="text-xl font-bold text-gray-900">{stats.active}</div>
              <div className="text-xs text-gray-500">Currently active.</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4 cursor-pointer hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Critical Alerts</div>
              <div className="text-xl font-bold text-red-600">{stats.critical}</div>
              <div className="text-xs text-gray-500">Immediate action required.</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4 cursor-pointer hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Warnings</div>
              <div className="text-xl font-bold text-amber-600">{stats.warnings}</div>
              <div className="text-xs text-gray-500">Monitor closely.</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4 cursor-pointer hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Info</div>
              <div className="text-xl font-bold text-blue-600">{stats.info}</div>
              <div className="text-xs text-gray-500">For awareness.</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4 cursor-pointer hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Resolved Today</div>
              <div className="text-xl font-bold text-green-600">{stats.resolved}</div>
              <div className="text-xs text-gray-500">Issues addressed.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="active">Active Alerts ({stats.active})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="all">All Alerts</TabsTrigger>
        </TabsList>

        {/* Active Alerts Tab */}
        <TabsContent value="active" className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Input
                placeholder="Search by product or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchAlerts}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4">
            {filteredAlerts.filter(a => !a.is_resolved).map((alert) => {
              const style = getSeverityStyle(alert.severity);
              const Icon = getAlertTypeIcon(alert.alert_type);
              
              return (
                <div
                  key={alert.id}
                  className={`rounded-xl border p-6 ${style.bg}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${style.icon}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <h3 className="font-semibold text-gray-900">
                            {alert.severity === 'critical' ? `Critical Stock Level - ${alert.product_name}` : alert.product_name}
                          </h3>
                          <Badge className={style.badge}>
                            {alert.severity?.charAt(0).toUpperCase() + alert.severity?.slice(1)}
                          </Badge>
                          {alert.sku && (
                            <Badge variant="outline" className="font-mono text-xs">
                              {alert.sku}
                            </Badge>
                          )}
                        </div>
                        <p className="text-gray-600 mb-4">{alert.message}</p>
                        
                        {alert.estimated_loss && (
                          <div className="mb-4">
                            <span className="text-sm text-gray-500">Estimated Loss: </span>
                            <span className="text-lg font-bold text-red-600">{formatCurrency(alert.estimated_loss || 0)}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          {alert.current_stock !== undefined && (
                            <div>
                              <div className="text-xs text-gray-500">Current Stock</div>
                              <div className="text-sm font-medium text-gray-900">
                                {alert.current_stock} units / {alert.min_stock} min
                              </div>
                            </div>
                          )}
                          {alert.location && (
                            <div>
                              <div className="text-xs text-gray-500">Location</div>
                              <div className="text-sm font-medium text-gray-900 flex items-center gap-1">
                                <Package className="w-3 h-3" />
                                {alert.location}
                              </div>
                            </div>
                          )}
                          {alert.days_to_stockout !== undefined && (
                            <div>
                              <div className="text-xs text-gray-500">Days to Stockout</div>
                              <div className="text-sm font-medium text-red-600">
                                {alert.days_to_stockout} days
                              </div>
                            </div>
                          )}
                          {alert.assigned_to && (
                            <div>
                              <div className="text-xs text-gray-500">Assigned To</div>
                              <div className="text-sm font-medium text-gray-900">
                                {alert.assigned_to}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>{new Date(alert.created_at).toLocaleString()}</span>
                          {alert.category && (
                            <>
                              <span>•</span>
                              <span>{alert.category}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedAlert(alert)}
                      >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Details
                      </Button>
                      {alert.severity === 'critical' && (
                        <Button
                          className="bg-red-600 hover:bg-red-700 text-white"
                          size="sm"
                          onClick={() => handleOrderImmediately(alert)}
                          disabled={false}
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          Order immediately
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredAlerts.filter(a => !a.is_resolved).length === 0 && (
              <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-12 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No active alerts</h3>
                <p className="text-gray-500 mt-1">All inventory levels are within normal parameters.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Resolved Tab */}
        <TabsContent value="resolved" className="space-y-4">
          <div className="space-y-4">
            {filteredAlerts.filter(a => a.is_resolved).map((alert) => {
              const style = getSeverityStyle(alert.severity);
              const Icon = getAlertTypeIcon(alert.alert_type);
              
              return (
                <div
                  key={alert.id}
                  className="rounded-xl border p-4 bg-gray-50 dark:bg-neutral-800 dark:border-neutral-600 border-gray-200 opacity-60"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${style.icon}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{alert.product_name}</h3>
                        <Badge className={style.badge}>
                          {alert.severity?.charAt(0).toUpperCase() + alert.severity?.slice(1)}
                        </Badge>
                        <Badge className="bg-green-100 text-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Resolved
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        Resolved {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredAlerts.filter(a => a.is_resolved).length === 0 && (
              <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-12 text-center">
                <p className="text-gray-500">No resolved alerts</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Alert Analytics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="text-sm text-purple-600 font-medium">Total Alerts</div>
                <div className="text-2xl font-bold text-purple-900">{stats.total}</div>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <div className="text-sm text-red-600 font-medium">Critical Rate</div>
                <div className="text-2xl font-bold text-red-900">
                  {stats.total > 0 ? Math.round((stats.critical / stats.total) * 100) : 0}%
                </div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-sm text-green-600 font-medium">Resolution Rate</div>
                <div className="text-2xl font-bold text-green-900">
                  {stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0}%
                </div>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-600 font-medium">Avg Response Time</div>
                <div className="text-2xl font-bold text-blue-900">2.5h</div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* All Alerts Tab */}
        <TabsContent value="all" className="space-y-4">
          <div className="space-y-4">
            {filteredAlerts.map((alert) => {
              const style = getSeverityStyle(alert.severity);
              const Icon = getAlertTypeIcon(alert.alert_type);
              
              return (
                <div
                  key={alert.id}
                  className={`rounded-xl border p-4 ${alert.is_resolved ? 'bg-gray-50 dark:bg-neutral-800 dark:border-neutral-600 border-gray-200 opacity-60' : style.bg}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${style.icon}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900">{alert.product_name}</h3>
                          <Badge className={style.badge}>
                            {alert.severity?.charAt(0).toUpperCase() + alert.severity?.slice(1)}
                          </Badge>
                          {alert.is_resolved && (
                            <Badge className="bg-green-100 text-green-600">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Resolved
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    
                    {!alert.is_resolved && (
                      <Button
                        onClick={() => resolveAlert(alert.id)}
                        variant="outline"
                        size="sm"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {selectedAlert && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-neutral-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Alert Details</h3>
              <Button variant="outline" size="sm" onClick={() => setSelectedAlert(null)}>
                Close
              </Button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><span className="text-gray-500">Product:</span> <span className="font-medium">{selectedAlert.product_name || '-'}</span></div>
                <div><span className="text-gray-500">SKU:</span> <span className="font-medium">{selectedAlert.sku || '-'}</span></div>
                <div><span className="text-gray-500">Type:</span> <span className="font-medium capitalize">{selectedAlert.alert_type || '-'}</span></div>
                <div><span className="text-gray-500">Severity:</span> <span className="font-medium capitalize">{selectedAlert.severity || '-'}</span></div>
                <div><span className="text-gray-500">Current Stock:</span> <span className="font-medium">{selectedAlert.current_stock ?? '-'}</span></div>
                <div><span className="text-gray-500">Available Stock:</span> <span className="font-medium">{selectedAlert.available_stock ?? '-'}</span></div>
                <div><span className="text-gray-500">Reorder Point:</span> <span className="font-medium">{selectedAlert.reorder_point ?? '-'}</span></div>
                <div><span className="text-gray-500">Safety Stock:</span> <span className="font-medium">{selectedAlert.safety_stock ?? '-'}</span></div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Message</div>
                <div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 p-3 text-gray-700 dark:text-gray-200">
                  {selectedAlert.message || 'No details provided.'}
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Created: {selectedAlert.created_at ? new Date(selectedAlert.created_at).toLocaleString() : '-'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
