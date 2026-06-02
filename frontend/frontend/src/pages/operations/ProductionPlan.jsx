import { useState, useEffect } from 'react';
import { Factory, Calendar, Package, Clock, CheckCircle, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { apiDelete, apiPut, apiGet } from '../../utils/api';
import { Button } from '../../components/ui/button';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';

export default function ProductionPlan() {
  const { confirm } = useConfirmDialog();
  const [plans, setPlans] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, in_progress: 0, delayed: 0 });
  const [loading, setLoading] = useState(true);
  const [updatingProcurement, setUpdatingProcurement] = useState({});
  const [updatingStatus, setUpdatingStatus] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPlan, setNewPlan] = useState({
    product_id: '',
    target_quantity: 100,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: 'medium'
  });
  const [products, setProducts] = useState([]);

  const generateFromForecasts = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch('http://localhost:3001/api/production/generate-from-forecasts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Failed to generate production plans from forecasts:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const onForecastsUpdated = async () => {
      await generateFromForecasts();
      fetchData();
    };
    window.addEventListener('app:forecasts-updated', onForecastsUpdated);
    return () => window.removeEventListener('app:forecasts-updated', onForecastsUpdated);
  }, []);

  useEffect(() => {
    const onOperationsUpdated = () => {
      fetchData();
    };
    window.addEventListener('app:operations-data-updated', onOperationsUpdated);
    return () => window.removeEventListener('app:operations-data-updated', onOperationsUpdated);
  }, []);

  const handleAddManualPlan = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/production', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPlan),
      });

      if (response.ok) {
        setShowAddModal(false);
        await fetchData();
        window.dispatchEvent(new CustomEvent('app:toast', { 
          detail: { type: 'success', title: 'Plan Created', description: 'Manual production plan added to schedule.' } 
        }));
      }
    } catch (error) {
      console.error('Failed to add production plan:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await apiGet('/api/products?limit=100');
      setProducts(data.products || []);
    } catch (e) {
      console.error('Fetch products failed', e);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const [plansRes, statsRes] = await Promise.all([
        fetch('http://localhost:3001/api/production', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('http://localhost:3001/api/production/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (plansRes.ok) {
        const data = await plansRes.json();
        setPlans(data.data?.productionPlans || data.productionPlans || data || []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.data || data || { total: 0, completed: 0, in_progress: 0, delayed: 0, scheduled: 0 });
      }

    } catch (error) {
      console.error('Failed to fetch production data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = async (id) => {
    const ok = await confirm('Delete this production plan? This will remove it from history.', {
      title: 'Delete Production Plan',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/production/${id}`);
      await fetchData();
      window.dispatchEvent(new CustomEvent('app:operations-data-updated'));
    } catch (e) {
      console.error('Delete production plan failed', e);
      alert(e?.message || 'Failed to delete plan.');
    }
  };

  const handleUpdatePlanStatus = async (plan, nextStatus) => {
    if (!plan?.id || !nextStatus) return;
    setUpdatingStatus((prev) => ({ ...prev, [plan.id]: true }));
    try {
      await apiPut(`/api/production/${plan.id}`, { status: nextStatus });
      await fetchData();
      window.dispatchEvent(new CustomEvent('app:operations-data-updated'));
    } catch (e) {
      console.error('Update production status failed', e);
      alert(e?.message || 'Failed to update production status.');
    } finally {
      setUpdatingStatus((prev) => ({ ...prev, [plan.id]: false }));
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      completed: 'bg-green-100 text-green-800 border-green-200',
      in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
      scheduled: 'bg-gray-100 text-gray-800 border-gray-200',
      delayed: 'bg-red-100 text-red-800 border-red-200',
      cancelled: 'bg-gray-100 text-gray-500 border-gray-200'
    };
    return styles[status] || styles.scheduled;
  };

  const getProcurementBadge = (status) => {
    const styles = {
      delivered: 'bg-green-100 text-green-800 border-green-200',
      in_transit: 'bg-blue-100 text-blue-800 border-blue-200',
      pending: 'bg-gray-100 text-gray-800 border-gray-200',
      approved: 'bg-purple-100 text-purple-800 border-purple-200',
      delayed: 'bg-red-100 text-red-800 border-red-200',
      cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
    };
    return styles[status] || styles.pending;
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      high: 'bg-red-500',
      medium: 'bg-amber-500',
      low: 'bg-green-500'
    };
    return styles[priority] || styles.low;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Factory className="w-7 h-7 text-emerald-600" />
            Kinglion Production Hub
          </h1>
          <p className="text-gray-500 mt-1">AI-driven manufacturing schedules for Kinglion Rwanda Investment Ltd</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Package className="w-5 h-5" />
            + Manual Plan
          </button>
          <button
            type="button"
            onClick={async () => {
              await generateFromForecasts();
              fetchData();
              window.dispatchEvent(new CustomEvent('app:toast', { 
                detail: { type: 'success', title: 'AI Plan Generated', description: 'Production schedules have been optimized based on latest demand forecasts.' } 
              }));
            }}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 shadow-md transition-all active:scale-95"
          >
            <CheckCircle className="w-5 h-5" />
            Optimize Production with AI
          </button>
        </div>
      </div>

      {/* Manual Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-neutral-800">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Create Production Plan</h3>
              <p className="text-sm text-gray-500 mt-1">Manually schedule a new manufacturing run</p>
            </div>
            <form onSubmit={handleAddManualPlan} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Product</label>
                <select 
                  required
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm bg-white dark:bg-neutral-800 dark:border-neutral-700"
                  value={newPlan.product_id}
                  onChange={(e) => setNewPlan({...newPlan, product_id: e.target.value})}
                >
                  <option value="">Select a product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Target Qty</label>
                  <input 
                    type="number" required
                    className="w-full rounded-lg border border-gray-300 p-2 text-sm dark:bg-neutral-800 dark:border-neutral-700"
                    value={newPlan.target_quantity}
                    onChange={(e) => setNewPlan({...newPlan, target_quantity: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
                  <select 
                    className="w-full rounded-lg border border-gray-300 p-2 text-sm dark:bg-neutral-800 dark:border-neutral-700"
                    value={newPlan.priority}
                    onChange={(e) => setNewPlan({...newPlan, priority: e.target.value})}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
                  <input 
                    type="date" required
                    className="w-full rounded-lg border border-gray-300 p-2 text-sm dark:bg-neutral-800 dark:border-neutral-700"
                    value={newPlan.start_date}
                    onChange={(e) => setNewPlan({...newPlan, start_date: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
                  <input 
                    type="date" required
                    className="w-full rounded-lg border border-gray-300 p-2 text-sm dark:bg-neutral-800 dark:border-neutral-700"
                    value={newPlan.end_date}
                    onChange={(e) => setNewPlan({...newPlan, end_date: e.target.value})}
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                  Create Plan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Plans</div>
              <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.total || 0}</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Completed</div>
              <div className="text-xl font-bold text-green-600">{stats.completed || 0}</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">In Progress</div>
              <div className="text-xl font-bold text-blue-600">{stats.in_progress || 0}</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Delayed</div>
              <div className="text-xl font-bold text-red-600">{stats.delayed || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Production Plans Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Production Schedule</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-200 dark:border-neutral-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Timeline</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Progress</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {plans.length > 0 ? plans.map((plan) => {
                const progress = plan.target_quantity > 0 
                  ? (plan.completed_quantity / plan.target_quantity) * 100 
                  : 0;
                const available = plan.available_stock ?? plan.current_stock ?? 0;
                const safety = plan.safety_stock ?? 0;
                const reorder = plan.reorder_point ?? 0;
                const stockStatus =
                  available <= safety ? 'shortage' : reorder && available < reorder ? 'reorder' : 'normal';
                return (
                  <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">{plan.product_name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{plan.sku}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                              stockStatus === 'shortage'
                                ? 'bg-red-100 text-red-800 border-red-200'
                                : stockStatus === 'reorder'
                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                  : 'bg-green-100 text-green-800 border-green-200'
                            }`}
                          >
                            {stockStatus === 'shortage'
                              ? 'Low'
                              : stockStatus === 'reorder'
                                ? 'Reorder'
                                : 'OK'}
                          </span>
                          <span className="text-gray-700 font-medium">{available}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Safety: {safety} • Reorder: {reorder}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">
                          {new Date(plan.start_date).toLocaleDateString()} - {new Date(plan.end_date).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-full max-w-[200px]">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{plan.completed_quantity} / {plan.target_quantity}</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{progress.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              progress === 100 ? 'bg-green-500' : progress > 50 ? 'bg-blue-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getPriorityBadge(plan.priority)}`}></div>
                        <span className="text-sm text-gray-600 capitalize">{plan.priority}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={plan.status || 'scheduled'}
                        onChange={(e) => handleUpdatePlanStatus(plan, e.target.value)}
                        disabled={Boolean(updatingStatus[plan.id])}
                        className={`h-8 rounded-md border px-2 text-xs font-medium ${getStatusBadge(plan.status || 'scheduled')}`}
                        title="Update production status"
                      >
                        <option value="scheduled">Scheduled</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="delayed">Delayed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => handleDeletePlan(plan.id)} title="Delete plan">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    No production plans found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
