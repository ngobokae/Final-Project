import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { apiGet, apiPost } from '../../utils/api';
import { formatCurrency } from '../../utils/currency';
import { Truck, Package, CheckCircle, AlertCircle, Clock } from 'lucide-react';

export default function PendingReceivables() {
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [receiving, setReceiving] = useState({});

  useEffect(() => {
    fetchPendingGoods();
  }, []);

  useEffect(() => {
    const onUpdate = () => fetchPendingGoods();
    window.addEventListener('app:operations-data-updated', onUpdate);
    return () => window.removeEventListener('app:operations-data-updated', onUpdate);
  }, []);

  const fetchPendingGoods = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiGet('/api/inventory/pending-receivables');
      setOrders(Array.isArray(data.pending_goods) ? data.pending_goods : []);
      setSummary(data.summary || null);
    } catch (e) {
      console.error('Failed to fetch pending goods:', e);
      setError(e?.message || 'Failed to load pending goods');
      setOrders([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveGoods = async (order) => {
    if (!order?.id) return;
    const st = String(order.status || '').toLowerCase();
    if (!['approved', 'in_transit'].includes(st)) return;

    setReceiving((prev) => ({ ...prev, [order.id]: true }));
    try {
      const response = await apiPost('/api/inventory/receive-procurement', {
        procurement_order_id: order.id,
        auto_confirm: true
      });

      if (response.success) {
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: {
            type: 'success',
            title: 'Goods Received',
            description: `Successfully received ${order.quantity} units of ${order.product_name}`
          }
        }));
        window.dispatchEvent(new Event('app:operations-data-updated'));
        window.dispatchEvent(new Event('app:forecasts-updated'));
        window.dispatchEvent(new Event('app:notifications-changed'));
        await fetchPendingGoods();
      }
    } catch (e) {
      console.error('Failed to receive goods:', e);
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: {
          type: 'error',
          title: 'Receive Failed',
          description: e?.message || 'Failed to receive goods'
        }
      }));
    } finally {
      setReceiving((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  const getStatusBadge = (status) => {
    const st = String(status || '').toLowerCase();
    const styles = {
      pending: { bg: 'bg-gray-100 text-gray-800 border-gray-200', icon: Clock, label: 'Awaiting Approval' },
      approved: { bg: 'bg-blue-100 text-blue-800 border-blue-200', icon: CheckCircle, label: 'Approved' },
      in_transit: { bg: 'bg-amber-100 text-amber-800 border-amber-200', icon: Truck, label: 'In Transit' },
      delayed: { bg: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle, label: 'Delayed' },
      delivered: { bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle, label: 'Completed' },
    };
    const style = styles[st] || { bg: 'bg-gray-100 text-gray-800 border-gray-200', icon: Package, label: status };
    const Icon = style.icon;
    return (
      <Badge className={`${style.bg} border`}>
        <Icon className="w-3 h-3 mr-1" />
        {style.label}
      </Badge>
    );
  };

  const openOrders = orders.filter((o) => !['delivered', 'cancelled'].includes(String(o.status || '').toLowerCase()));
  const completedOrders = orders.filter((o) => String(o.status || '').toLowerCase() === 'delivered');
  const receivableOrders = openOrders.filter((o) => ['approved', 'in_transit'].includes(String(o.status || '').toLowerCase()));
  const awaitingApproval = openOrders.filter((o) => String(o.status || '').toLowerCase() === 'pending');

  const openUnits = summary?.open_units ?? openOrders.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0);
  const openValue = summary?.open_value ?? openOrders.reduce((sum, o) => sum + (Number(o.total_cost) || 0), 0);
  const completedCount = summary?.completed_count ?? completedOrders.length;
  const completedValue = summary?.completed_value ?? completedOrders.reduce((sum, o) => sum + (Number(o.total_cost) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Truck className="w-7 h-7 text-emerald-600" />
            Pending Delivery
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Open purchase orders and recently completed deliveries. Receive goods once Operations approves and delivery arrives.
          </p>
        </div>
        <Button onClick={fetchPendingGoods} variant="outline">
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Awaiting Approval</p>
                <p className="text-2xl font-bold">{awaitingApproval.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Truck className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Ready to Receive</p>
                <p className="text-2xl font-bold">{receivableOrders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
                <p className="text-2xl font-bold">{completedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-emerald-600" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Open Units</p>
                <p className="text-2xl font-bold">{openUnits}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-amber-600" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Open Value</p>
                <p className="text-2xl font-bold">{formatCurrency(openValue)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Completed: {formatCurrency(completedValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Purchase Orders</CardTitle>
          <CardDescription>
            Open orders and recently completed deliveries (last 30 days). Status changes also appear in Stock Transactions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <Truck className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 font-medium">No orders yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Use Quick PO or Create Order in Stock Transactions to send a request to Operations.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Product</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">SKU</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Ordered Qty</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Current Stock</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Total</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Supplier</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const st = String(order.status || '').toLowerCase();
                    const canReceive = ['approved', 'in_transit'].includes(st);
                    const isCompleted = st === 'delivered';
                    return (
                      <tr
                        key={order.id}
                        className={`border-b border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors ${isCompleted ? 'opacity-80' : ''}`}
                      >
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">{order.product_name || '-'}</td>
                        <td className="py-3 px-4 font-mono text-xs text-gray-600 dark:text-gray-400">{order.sku || '-'}</td>
                        <td className="py-3 px-4 text-center font-semibold text-emerald-600">{order.quantity}</td>
                        <td className="py-3 px-4 text-center text-gray-700 dark:text-gray-300">{order.current_stock ?? '-'}</td>
                        <td className="py-3 px-4 text-right font-semibold">{formatCurrency(Number(order.total_cost || 0))}</td>
                        <td className="py-3 px-4">{getStatusBadge(order.status)}</td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{order.supplier_name || 'N/A'}</td>
                        <td className="py-3 px-4">
                          {canReceive ? (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => handleReceiveGoods(order)}
                              disabled={receiving[order.id]}
                            >
                              {receiving[order.id] ? 'Receiving...' : 'Receive'}
                            </Button>
                          ) : isCompleted ? (
                            <span className="text-xs text-emerald-600 font-medium">Stock updated</span>
                          ) : (
                            <span className="text-xs text-gray-500">
                              {st === 'pending' ? 'Waiting for Operations' : st === 'delayed' ? 'Follow up with supplier' : '-'}
                            </span>
                          )}
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
    </div>
  );
}
