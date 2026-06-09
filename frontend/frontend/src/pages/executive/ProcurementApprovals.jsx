import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { CheckCircle, Clock, Truck, AlertCircle, Eye, Package } from 'lucide-react';
import { apiGet } from '../../utils/api';
import { formatCurrency } from '../../utils/currency';

export default function ProcurementApprovals() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const isOpen = (o) => !['delivered', 'cancelled'].includes(String(o.status || '').toLowerCase());

  const pendingOrders = orders.filter((o) => String(o.status || '').toLowerCase() === 'pending');
  const approvedOrders = orders.filter((o) => String(o.status || '').toLowerCase() === 'approved');
  const inTransitOrders = orders.filter((o) => String(o.status || '').toLowerCase() === 'in_transit');
  const completedOrders = orders.filter((o) => String(o.status || '').toLowerCase() === 'delivered');
  const openOrders = orders.filter(isOpen);

  const completedValue = completedOrders.reduce((s, o) => s + Number(o.total_cost || 0), 0);
  const openValue = openOrders.reduce((s, o) => s + Number(o.total_cost || 0), 0);

  const renderOrderRow = (order, badgeLabel, badgeClass) => (
    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
      <div>
        <div className="font-semibold">{order.product_name} ({order.sku})</div>
        <div className="text-sm text-gray-600">
          {order.quantity} units — {formatCurrency(order.total_cost || 0)}
          {order.supplier_name ? ` · ${order.supplier_name}` : ''}
        </div>
      </div>
      <Badge className={badgeClass}>{badgeLabel}</Badge>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <Eye className="w-8 h-8 text-emerald-600" />
          Procurement Order Monitor
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Read-only view for executives. Operations approves inventory purchase requests in Procurement Plan.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Pending (Operations)</div>
          <div className="text-3xl font-bold text-orange-600 mt-1">{pendingOrders.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Approved</div>
          <div className="text-3xl font-bold text-emerald-600 mt-1">{approvedOrders.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">In Transit</div>
          <div className="text-3xl font-bold text-blue-600 mt-1">{inTransitOrders.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Completed</div>
          <div className="text-3xl font-bold text-emerald-700 mt-1">{completedOrders.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Open / Completed Value</div>
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(openValue)}</div>
          <div className="text-xs text-emerald-600 mt-1">Completed: {formatCurrency(completedValue)}</div>
        </Card>
      </div>

      {pendingOrders.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-600" />
            Awaiting Operations Approval
          </h2>
          <div className="space-y-3">
            {pendingOrders.map((order) => renderOrderRow(order, 'Pending', 'bg-orange-100 text-orange-700'))}
          </div>
        </Card>
      )}

      {approvedOrders.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            Approved by Operations
          </h2>
          <div className="space-y-3">
            {approvedOrders.map((order) => renderOrderRow(order, 'Approved', 'bg-emerald-100 text-emerald-700'))}
          </div>
        </Card>
      )}

      {inTransitOrders.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            In Transit
          </h2>
          <div className="space-y-3">
            {inTransitOrders.map((order) => renderOrderRow(order, 'In Transit', 'bg-blue-100 text-blue-700'))}
          </div>
        </Card>
      )}

      {completedOrders.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-700" />
            Completed Deliveries
          </h2>
          <div className="space-y-3">
            {completedOrders.map((order) => renderOrderRow(order, 'Completed', 'bg-emerald-100 text-emerald-800'))}
          </div>
        </Card>
      )}

      {!loading && orders.length === 0 && (
        <Card className="p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold">No procurement orders</h3>
          <p className="text-gray-600 mt-1">Orders are created by Inventory and approved by Operations.</p>
        </Card>
      )}
    </div>
  );
}
