import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { apiGet, apiPost } from '../../utils/api';
import { formatCurrency } from '../../utils/currency';
import { Truck, Package, CheckCircle, AlertCircle } from 'lucide-react';

export default function PendingReceivables() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [receiving, setReceiving] = useState({});

  useEffect(() => {
    fetchPendingGoods();
  }, []);

  const fetchPendingGoods = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiGet('/api/inventory/pending-receivables');
      setOrders(Array.isArray(data.pending_goods) ? data.pending_goods : []);
    } catch (e) {
      console.error('Failed to fetch pending goods:', e);
      setError(e?.message || 'Failed to load pending goods');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveGoods = async (order, autoConfirm = true) => {
    if (!order?.id) return;

    setReceiving((prev) => ({ ...prev, [order.id]: true }));
    try {
      const response = await apiPost('/api/inventory/receive-procurement', {
        procurement_order_id: order.id,
        auto_confirm: autoConfirm
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
    const styles = {
      approved: { bg: 'bg-blue-100 text-blue-800 border-blue-200', icon: CheckCircle },
      in_transit: { bg: 'bg-amber-100 text-amber-800 border-amber-200', icon: Truck },
    };
    const style = styles[String(status || '').toLowerCase()] || { bg: 'bg-gray-100 text-gray-800 border-gray-200', icon: Package };
    const Icon = style.icon;
    return (
      <Badge className={`${style.bg} border`}>
        <Icon className="w-3 h-3 mr-1" />
        {String(status || 'Pending').charAt(0).toUpperCase() + String(status || 'Pending').slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Truck className="w-7 h-7 text-emerald-600" />
            Pending Receivables
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Orders approved by Operations awaiting goods receipt into inventory
          </p>
        </div>
        <Button onClick={fetchPendingGoods} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Truck className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Orders</p>
                <p className="text-2xl font-bold">{orders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-emerald-600" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Units Ready</p>
                <p className="text-2xl font-bold">{orders.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-amber-600" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Value</p>
                <p className="text-2xl font-bold">{formatCurrency(orders.reduce((sum, o) => sum + (Number(o.total_cost) || 0), 0))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Pending Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Orders Ready to Receive</CardTitle>
          <CardDescription>
            Approved and in-transit orders from your suppliers. Click "Receive" to add stock to inventory.
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
              <p className="text-gray-600 dark:text-gray-400 font-medium">No pending orders</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                All approved orders have been received or there are none awaiting receipt.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Product</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">SKU</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Quantity</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Current Stock</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Unit Cost</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Total</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Supplier</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Order Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{order.product_name || '-'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{order.sku || '-'}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold text-emerald-600">{order.quantity}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-gray-700 dark:text-gray-300">{order.current_stock ?? '-'}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                        {formatCurrency(Number(order.unit_cost || 0))}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(Number(order.total_cost || 0))}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {order.supplier_name || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {order.order_date ? new Date(order.order_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleReceiveGoods(order, true)}
                          disabled={receiving[order.id]}
                        >
                          {receiving[order.id] ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                              Receiving...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Receive
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
        <CardHeader>
          <CardTitle className="text-blue-900 dark:text-blue-200">Workflow Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
          <p>
            <strong>1. Operations Manager:</strong> Creates and approves procurement orders
          </p>
          <p>
            <strong>2. Inventory Manager:</strong> Reviews pending orders here and clicks "Receive" when goods arrive
          </p>
          <p>
            <strong>3. Automatic:</strong> Stock is added to inventory, alerts are resolved, and order is marked as delivered
          </p>
          <p>
            <strong>4. Tracking:</strong> All transactions are recorded in Stock Transactions for audit trail
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
