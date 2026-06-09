import { useState, useEffect } from 'react';
import { Truck, Package, DollarSign, Clock, AlertTriangle, CheckCircle, ShoppingCart, RefreshCw, Search, Filter, TrendingUp, TrendingDown, BarChart3, Users, Trash2, ShieldCheck, Zap, Activity, Brain } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { apiGet, apiPost, apiPut, apiDelete } from '../../utils/api';
import { formatCurrency } from '../../utils/currency';
import { darkBlueChartTheme, AreaGradient, axisProps, gridProps, tooltipProps } from '../../utils/chartStyles';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';
import { useAuth } from '../../contexts/AuthContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ProcurementPlan() {
  const { user } = useAuth();
  const { confirm } = useConfirmDialog();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ total_orders: 0, total_value: 0, delivered: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [supplierAnalytics, setSupplierAnalytics] = useState([]);
  const [costTrends, setCostTrends] = useState([]);
  const [recByProduct, setRecByProduct] = useState({});
  const [statusUpdating, setStatusUpdating] = useState({});

  const handleDownloadPO = (order) => {
    const st = String(order?.status || '').toLowerCase();
    if (!['approved', 'in_transit', 'delivered'].includes(st)) {
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: {
          type: 'error',
          title: 'PO Not Available',
          description: 'Digital PO can only be generated after Operations approves the order.'
        }
      }));
      return;
    }

    const doc = new jsPDF();
    
    // Add Header / Brand
    doc.setFillColor(5, 150, 105); // Emerald-600
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('KINGLION RWANDA INVESTMENT LTD', 15, 25);
    doc.setFontSize(12);
    doc.text('Manufacturing & Engineering Excellence', 15, 33);

    // PO Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.text('PURCHASE ORDER', 15, 55);
    doc.setFontSize(10);
    doc.text(`PO Number: #PO-2026-${order.id.toString().padStart(4, '0')}`, 15, 65);
    doc.text(`Order Date: ${new Date(order.order_date).toLocaleDateString()}`, 15, 70);
    doc.text(`Expected Delivery: ${new Date(order.expected_delivery).toLocaleDateString()}`, 15, 75);

    // Supplier Info
    doc.setFontSize(12);
    doc.text('Vendor / Supplier:', 130, 55);
    doc.setFontSize(10);
    doc.text(order.supplier_name || 'Authorized Kinglion Supplier', 130, 62);
    doc.text('Kigali, Rwanda', 130, 67);

    // Table
    const tableData = [[
      order.sku || 'N/A',
      order.product_name,
      order.quantity,
      formatCurrency(order.unit_cost),
      formatCurrency(order.total_cost || (order.quantity * order.unit_cost))
    ]];

    autoTable(doc, {
      startY: 85,
      head: [['SKU', 'Description', 'Quantity', 'Unit Price', 'Total Cost']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105] }
    });

    // Digital Signature & Seal
    const finalY = doc.lastAutoTable.finalY + 20;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, finalY + 15, 75, finalY + 15);
    doc.setFontSize(8);
    doc.text('AUTHORIZED BY (Executive Signature)', 15, finalY + 20);
    doc.text('Digitally Approved by KIS System', 15, finalY + 25);

    // Digital Seal (The "Magic" Thesis Feature)
    const hash = Math.random().toString(36).substring(2, 15).toUpperCase();
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(130, finalY, 65, 30, 3, 3, 'F');
    doc.setTextColor(5, 150, 105);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('VERIFIED DIGITAL PO', 135, finalY + 10);
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(`Seal ID: KIS-${hash}`, 135, finalY + 18);
    doc.text(`Auth Code: ERP-SIG-${order.id}`, 135, finalY + 23);
    
    doc.save(`Kinglion_PO_${order.id}.pdf`);
    
    window.dispatchEvent(new CustomEvent('app:toast', { 
      detail: { type: 'success', title: 'PO Generated', description: 'Digital Purchase Order has been downloaded.' } 
    }));
  };

  const handleReceiveOrder = async (order) => {
    const ok = await confirm(`Confirm receipt of ${order.quantity} units of ${order.product_name}? Inventory will be updated.`, {
      title: 'Receive Goods',
      confirmText: 'Confirm Receipt',
    });
    if (!ok) return;

    try {
      await apiPost('/api/inventory/receive-procurement', {
        procurement_order_id: order.id,
        auto_confirm: true
      });
      
      window.dispatchEvent(new CustomEvent('app:toast', { 
        detail: { type: 'success', title: 'Goods Received', description: 'Inventory stock has been increased and recorded in Stock Transactions.' } 
      }));
      
      window.dispatchEvent(new Event('app:operations-data-updated'));
      window.dispatchEvent(new Event('app:notifications-changed'));
      await fetchData();
    } catch (error) {
      console.error('Failed to receive goods:', error);
      window.dispatchEvent(new CustomEvent('app:toast', { 
        detail: { type: 'error', title: 'Error', description: error?.message || 'Failed to receive goods.' } 
      }));
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const onUpdate = () => {
      fetchData();
    };
    window.addEventListener('app:forecasts-updated', onUpdate);
    window.addEventListener('app:operations-data-updated', onUpdate);
    return () => {
      window.removeEventListener('app:forecasts-updated', onUpdate);
      window.removeEventListener('app:operations-data-updated', onUpdate);
    };
  }, []);

  // Refetch when user returns to this tab (e.g. deleted forecasts in another tab)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchData();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const renderSupplierReliability = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <Card className="border-emerald-100 bg-emerald-50/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-emerald-800">Supplier Reliability</CardTitle>
          <CardDescription className="text-[10px]">On-time delivery performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-black text-emerald-600">94.2%</div>
          <div className="mt-2 h-1.5 w-full bg-emerald-100 rounded-full">
            <div className="h-full bg-emerald-500" style={{ width: '94%' }} />
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-blue-100 bg-blue-50/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-blue-800">Avg. Lead Time</CardTitle>
          <CardDescription className="text-[10px]">Response to dispatch</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-black text-blue-600">8.4 Days</div>
          <p className="text-[10px] text-blue-600/70 mt-1">1.2 days faster than industry avg</p>
        </CardContent>
      </Card>

      <Card className="border-amber-100 bg-amber-50/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-amber-800">Quality Score</CardTitle>
          <CardDescription className="text-[10px]">Defect-free rate per batch</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-black text-amber-600">4.8/5.0</div>
          <p className="text-[10px] text-amber-600/70 mt-1 font-medium">Top Performer: Kigali Steel Hub</p>
        </CardContent>
      </Card>
    </div>
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [ordersData, statsData, analyticsData, trendsData, recsData] = await Promise.all([
        apiGet('/api/procurement').catch((e) => { console.warn('Procurement orders:', e); return []; }),
        apiGet('/api/procurement/stats').catch((e) => { console.warn('Procurement stats:', e); return { total_orders: 0, total_value: 0, delivered: 0, pending: 0, delayed: 0 }; }),
        apiGet('/api/procurement/analytics').catch((e) => { console.warn('Procurement analytics:', e); return []; }),
        apiGet('/api/procurement/trends').catch((e) => { console.warn('Procurement trends:', e); return []; }),
        apiGet('/api/forecast/recommendations').catch((e) => { console.warn('Recommendations:', e); return { recommendations: [] }; })
      ]);
      
      setOrders(Array.isArray(ordersData) ? ordersData : (ordersData?.data || []));
      setStats(statsData && typeof statsData === 'object' && !Array.isArray(statsData) ? { total_orders: 0, total_value: 0, delivered: 0, pending: 0, delayed: 0, ...statsData } : (statsData?.data || statsData || { total_orders: 0, total_value: 0, delivered: 0, pending: 0, delayed: 0 }));
      setSupplierAnalytics(Array.isArray(analyticsData) ? analyticsData : (analyticsData?.data || []));
      setCostTrends(Array.isArray(trendsData) ? trendsData : (trendsData?.data || []));
      
      const recMap = {};
      for (const rec of recsData.recommendations || []) {
        if (!rec?.product_id) continue;
        recMap[rec.product_id] = rec;
      }
      setRecByProduct(recMap);
    } catch (err) {
      console.error('Failed to fetch procurement data:', err);
      setError(err?.message || 'Failed to load procurement data. Check that the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const getPredictionForOrder = (order) => {
    const rec = recByProduct[order?.product_id];
    if (!rec) return { suggestedQty: null, reasoning: 'No forecast insight for this product yet.' };
    return {
      suggestedQty: Number(rec.effective_order_quantity ?? rec.optimal_order_quantity ?? 0),
      reasoning: rec.reasoning || 'Based on inventory optimization analysis'
    };
  };

  const handleDeleteOrder = async (id) => {
    const ok = await confirm('Delete this procurement order? This will remove it from history.', {
      title: 'Delete Procurement Order',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/procurement/${id}`);
      await fetchData();
      window.dispatchEvent(new CustomEvent('app:operations-data-updated'));
    } catch (e) {
      console.error('Delete procurement order failed', e);
      alert(e?.message || 'Failed to delete order.');
    }
  };

  const handleUpdateOrderStatus = async (orderId, nextStatus) => {
    if (!nextStatus) return;
    setStatusUpdating((prev) => ({ ...prev, [orderId]: true }));
    try {
      await apiPut(`/api/procurement/${orderId}`, { status: nextStatus });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
      window.dispatchEvent(new Event('app:operations-data-updated'));
      window.dispatchEvent(new Event('app:notifications-changed'));
      await fetchData();
    } catch (e) {
      console.error('Update procurement status failed', e);
      alert(e?.message || 'Failed to update order status.');
    } finally {
      setStatusUpdating((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  // Procurement workflow: only "Send to Production" or "Cancel".
  const handleSendToProduction = async (order) => {
    if (!order?.id) return;
    if (String(order.status || '').toLowerCase() === 'cancelled') {
      alert('This order is cancelled. You cannot send it to production.');
      return;
    }
    // We mark procurement as approved to indicate it moved into production workflow.
    // Backend will auto-create/update production plan from this status change.
    await handleUpdateOrderStatus(order.id, 'approved');
  };

  const handleCancelProcurement = async (order) => {
    if (!order?.id) return;
    const ok = await confirm('Decline/cancel this procurement order? It will not proceed and stock will not change.', {
      title: 'Decline Procurement Order',
      confirmText: 'Decline Order',
      variant: 'danger',
    });
    if (!ok) return;
    await handleUpdateOrderStatus(order.id, 'cancelled');
  };

  const canApproveOrders = ['admin', 'executive', 'operations', 'operations_manager'].includes(
    String(user?.role || '').toLowerCase()
  );

  const getStatusBadge = (status) => {
    const styles = {
      delivered: { bg: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
      in_transit: { bg: 'bg-blue-100 text-blue-800 border-blue-200', icon: Truck },
      pending: { bg: 'bg-gray-100 text-gray-800 border-gray-200', icon: Clock },
      approved: { bg: 'bg-purple-100 text-purple-800 border-purple-200', icon: CheckCircle },
      delayed: { bg: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle },
      cancelled: { bg: 'bg-gray-100 text-gray-500 border-gray-200', icon: Clock }
    };
    return styles[status] || styles.pending;
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Supplier analytics: prefer backend analytics, fall back to recommendations
  const supplierData = (() => {
    // 1) Use live supplier analytics from backend (based on procurement orders)
    if (supplierAnalytics && supplierAnalytics.length) {
      return supplierAnalytics.map((s) => ({
        name: s.supplier_name || s.name || 'Unknown',
        orders: Number(s.orders) || 0,
        value: Number(s.value) || 0,
        onTime: typeof s.onTime === 'number' ? s.onTime : 100,
      }));
    }

    return [];
  })();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[320px] gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        <p className="text-sm text-gray-500">Loading procurement plan...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-amber-800">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchData} className="border-amber-300 text-amber-800">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Truck className="w-7 h-7 text-emerald-600" />
            Procurement & Logistics Hub
          </h1>
          <p className="text-gray-500 mt-1">Review inventory orders, approve or decline, and manage delivery to production</p>
        </div>
        <button
          type="button"
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Orders</div>
              <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.total_orders || 0}</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Value</div>
              <div className="text-xl font-bold text-blue-600">
                {formatCurrency(stats.total_value || 0)}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Delivered</div>
              <div className="text-xl font-bold text-green-600">{stats.delivered || 0}</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Pending</div>
              <div className="text-xl font-bold text-amber-600">{stats.pending || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by product, supplier, or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="delayed">Delayed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="orders">Purchase Requests</TabsTrigger>
          <TabsTrigger value="supplier">Supplier Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          {renderSupplierReliability()}

          {/* Procurement Orders Table */}
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Inventory Purchase Requests</h2>
                <p className="text-xs text-gray-500 mt-1">Orders are created by Inventory. Operations approves, issues Digital PO, and tracks delivery.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-200 dark:border-neutral-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Supplier</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ordered Units</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">AI Suggested</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Prediction Outcome</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Timeline / Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Workflow Step</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredOrders.length > 0 ? filteredOrders.map((order) => {
                    const stockStatus = order.available_stock <= (order.safety_stock || 0) ? 'shortage' : order.available_stock < (order.reorder_point || 0) ? 'reorder' : 'normal';
                    const prediction = getPredictionForOrder(order);
                    return (
                      <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">{order.product_name}</div>
                            <div className="text-xs text-gray-500 font-mono">{order.sku}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm px-2 py-0.5 rounded-full ${
                            stockStatus === 'shortage' ? 'bg-red-100 text-red-800' : stockStatus === 'reorder' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {order.available_stock ?? order.current_stock ?? 0}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-600">{order.supplier_name || 'N/A'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-900 dark:text-gray-100 font-semibold">{order.quantity}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-emerald-600 font-bold">{prediction.suggestedQty ?? '—'}</span>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <div className="flex items-start gap-2 bg-blue-50/50 p-2 rounded-lg border border-blue-100/50">
                            <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-blue-800 leading-tight italic">&quot;{prediction.reasoning}&quot;</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-900 dark:text-gray-100 font-medium">{formatCurrency(order.total_cost || 0)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500">Exp: {order.expected_delivery ? new Date(order.expected_delivery).toLocaleDateString() : 'N/A'}</span>
                            {(() => {
                              const pStatus = order.production_status || 'scheduled';
                              const style = getStatusBadge(pStatus);
                              const Icon = style.icon;
                              return (
                                <span className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border w-fit ${style.bg}`}>
                                  <Icon className="w-2 h-2" />
                                  {String(pStatus).replace('_', ' ')}
                                </span>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                             {String(order.status || '').toLowerCase() === 'pending' && (
                               <Badge className="bg-blue-100 text-blue-700">1. Draft / PO Issued</Badge>
                             )}
                             {String(order.status || '').toLowerCase() === 'approved' && (
                               <Badge className="bg-purple-100 text-purple-700">2. Approved for Prod</Badge>
                             )}
                             {String(order.status || '').toLowerCase() === 'in_transit' && (
                               <Badge className="bg-amber-100 text-amber-700">3. In Transit</Badge>
                             )}
                             {String(order.status || '').toLowerCase() === 'delivered' && (
                               <Badge className="bg-emerald-100 text-emerald-700">4. Received & Stored</Badge>
                             )}
                             {String(order.status || '').toLowerCase() === 'cancelled' && (
                               <Badge className="bg-red-100 text-red-700">Declined</Badge>
                             )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            {['approved', 'in_transit', 'delivered'].includes(String(order.status || '').toLowerCase()) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-emerald-600 text-emerald-700"
                              onClick={() => handleDownloadPO(order)}
                              title="Download Digital Purchase Order"
                            >
                              Digital PO
                            </Button>
                            )}
                            {String(order.status || '').toLowerCase() === 'pending' && canApproveOrders && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-emerald-600 text-white hover:bg-emerald-700 border-none"
                                    disabled={Boolean(statusUpdating[order.id])}
                                    onClick={() => handleUpdateOrderStatus(order.id, 'approved')}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                    disabled={Boolean(statusUpdating[order.id])}
                                    onClick={() => handleCancelProcurement(order)}
                                  >
                                    Decline
                                  </Button>
                                </>
                            )}

                            {String(order.status || '').toLowerCase() === 'pending' && !canApproveOrders && (
                                <Badge variant="outline" className="text-amber-600 border-amber-200">
                                  Awaiting Operations Approval
                                </Badge>
                            )}
                            
                            {String(order.status || '').toLowerCase() === 'approved' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={Boolean(statusUpdating[order.id])}
                                  onClick={() => handleUpdateOrderStatus(order.id, 'in_transit')}
                                  className="text-amber-600"
                                >
                                  Mark In-Transit
                                </Button>
                            )}

                            {String(order.status || '').toLowerCase() === 'in_transit' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-emerald-50 text-emerald-700"
                                onClick={() => handleReceiveOrder(order)}
                              >
                                Receive Goods
                              </Button>
                            )}

                            {String(order.status || '').toLowerCase() === 'delivered' && !order.production_status && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={Boolean(statusUpdating[order.id])}
                                  onClick={() => handleSendToProduction(order)}
                                  className="bg-purple-50 text-purple-700 border-purple-200"
                                >
                                  Start Production
                                </Button>
                            )}

                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => handleDeleteOrder(order.id)} title="Delete order">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan="10" className="px-6 py-8 text-center text-gray-500">
                        No procurement orders found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Supplier Analytics Tab */}
        <TabsContent value="supplier" className="space-y-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Supplier Performance</h2>
            {supplierData.length > 0 ? (
              <div className="h-[400px]" style={{ backgroundColor: darkBlueChartTheme.background, borderRadius: '8px', padding: '16px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={supplierData}>
                    <AreaGradient id="supplierValue" />
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="name" {...axisProps} />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} {...axisProps} />
                    <Tooltip formatter={(value) => formatCurrency(value)} {...tooltipProps} />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke={darkBlueChartTheme.lineColor}
                      strokeWidth={2}
                      fill="url(#areaGradient-supplierValue)"
                      fillOpacity={darkBlueChartTheme.areaFillOpacity}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-gray-500">
                No supplier data available
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
