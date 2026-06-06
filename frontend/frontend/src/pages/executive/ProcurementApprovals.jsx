import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { CheckCircle, Clock, Truck, AlertCircle } from 'lucide-react';
import { apiGet, apiPut } from '../../utils/api';
import { formatCurrency } from '../../utils/currency';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';

export default function ProcurementApprovals() {
  const { confirm } = useConfirmDialog();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState({});

  useEffect(() => {
    fetchOrders();
    const handleUpdate = () => fetchOrders();
    window.addEventListener('app:operations-data-updated', handleUpdate);
    return () => window.removeEventListener('app:operations-data-updated', handleUpdate);
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await apiGet('/api/procurement');
      setOrders(Array.isArray(res) ? res : res?.data || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (orderId, orderDetails) => {
    const ok = await confirm(`Approve ${orderDetails.quantity} units of ${orderDetails.product_name}?`, {
      title: 'Approve Procurement Order',
      confirmText: 'Approve'
    });
    if (!ok) return;

    setApproving((prev) => ({ ...prev, [orderId]: true }));
    try {
      const response = await apiPut(`/api/procurement/${orderId}`, { status: 'approved' });
      console.log('Approval response:', response);
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { type: 'success', title: 'Approved', description: 'Procurement order approved successfully.' }
      }));
      window.dispatchEvent(new Event('app:operations-data-updated'));
      await fetchOrders();
    } catch (error) {
      console.error('Approval error:', error);
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { type: 'error', title: 'Error', description: error?.message || 'Failed to approve order.' }
      }));
    } finally {
      setApproving((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const pendingOrders = orders.filter(o => String(o.status || '').toLowerCase() === 'pending');
  const approvedOrders = orders.filter(o => String(o.status || '').toLowerCase() === 'approved');
  const inTransitOrders = orders.filter(o => String(o.status || '').toLowerCase() === 'in_transit');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
          Procurement Approvals
        </h1>
        <p className="text-gray-600 dark:text-gray-400">Review and approve pending procurement orders</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Pending Approval</div>
          <div className="text-3xl font-bold text-orange-600 mt-1">{pendingOrders.length}</div>
          <div className="text-xs text-gray-500 mt-1">Awaiting your review</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Approved</div>
          <div className="text-3xl font-bold text-emerald-600 mt-1">{approvedOrders.length}</div>
          <div className="text-xs text-gray-500 mt-1">Ready for production</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">In Transit</div>
          <div className="text-3xl font-bold text-blue-600 mt-1">{inTransitOrders.length}</div>
          <div className="text-xs text-gray-500 mt-1">On the way to warehouse</div>
        </Card>
      </div>

      {/* Pending Orders */}
      {pendingOrders.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-600" />
            Pending Approval
          </h2>
          <div className="space-y-3">
            {pendingOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 border border-orange-200 dark:border-orange-900/30 rounded-lg bg-orange-50 dark:bg-orange-950/10"
              >
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {order.product_name} ({order.sku})
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {order.quantity} units @ {formatCurrency(order.unit_cost)} from {order.supplier_name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Expected delivery: {new Date(order.expected_delivery).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <div className="text-right">
                    <div className="font-bold text-gray-900 dark:text-gray-100">
                      {formatCurrency(order.total_cost || 0)}
                    </div>
                    <Badge className="mt-1 bg-orange-100 text-orange-700">Pending</Badge>
                  </div>
                  <Button
                    onClick={() => handleApprove(order.id, order)}
                    disabled={Boolean(approving[order.id])}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap"
                  >
                    {approving[order.id] ? 'Approving...' : 'Approve'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Approved Orders */}
      {approvedOrders.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            Approved Orders
          </h2>
          <div className="space-y-3">
            {approvedOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 border border-emerald-200 dark:border-emerald-900/30 rounded-lg bg-emerald-50 dark:bg-emerald-950/10"
              >
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {order.product_name} ({order.sku})
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {order.quantity} units @ {formatCurrency(order.unit_cost)} from {order.supplier_name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Expected delivery: {new Date(order.expected_delivery).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(order.total_cost || 0)}
                  </div>
                  <Badge className="mt-1 bg-emerald-100 text-emerald-700">Approved</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* In Transit Orders */}
      {inTransitOrders.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            In Transit
          </h2>
          <div className="space-y-3">
            {inTransitOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 border border-blue-200 dark:border-blue-900/30 rounded-lg bg-blue-50 dark:bg-blue-950/10"
              >
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {order.product_name} ({order.sku})
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {order.quantity} units from {order.supplier_name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Expected delivery: {new Date(order.expected_delivery).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(order.total_cost || 0)}
                  </div>
                  <Badge className="mt-1 bg-blue-100 text-blue-700">In Transit</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* No Orders */}
      {!loading && orders.length === 0 && (
        <Card className="p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">No procurement orders</h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Orders will appear here when created by Operations</p>
        </Card>
      )}

      {loading && (
        <Card className="p-12 text-center">
          <div className="text-gray-500">Loading procurement orders...</div>
        </Card>
      )}
    </div>
  );
}
