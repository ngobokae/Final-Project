import { useState, useEffect } from 'react';
import { Factory, Calendar, Clock, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { apiDelete, apiPut, apiGet } from '../../utils/api';
import { Button } from '../../components/ui/button';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';

export default function ProductionPlan() {
  const { confirm } = useConfirmDialog();
  const [plans, setPlans] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, in_progress: 0, delayed: 0 });
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const onOperationsUpdated = () => {
      fetchData();
    };
    window.addEventListener('app:operations-data-updated', onOperationsUpdated);
    window.addEventListener('app:forecasts-updated', onOperationsUpdated);
    return () => {
      window.removeEventListener('app:operations-data-updated', onOperationsUpdated);
      window.removeEventListener('app:forecasts-updated', onOperationsUpdated);
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const [plansRes, statsRes] = await Promise.all([
        fetch('http://localhost:3001/api/production', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('http://localhost:3001/api/production/stats', {
          headers: { Authorization: `Bearer ${token}` }
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Factory className="w-7 h-7 text-emerald-600" />
            Kinglion Production Hub
          </h1>
          <p className="text-gray-500 mt-1">
            Production schedules created from Inventory — view and update status here.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Factory className="w-5 h-5 text-gray-600" />
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
              <Calendar className="w-5 h-5 text-green-600" />
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
                const progress = plan.status === 'completed'
                  ? 100
                  : plan.target_quantity > 0
                  ? Math.min(100, (plan.completed_quantity / plan.target_quantity) * 100)
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
                            className="bg-emerald-600 h-2 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block w-3 h-3 rounded-full ${getPriorityBadge(plan.priority)}`} />
                      <span className="ml-2 text-sm text-gray-600 capitalize">{plan.priority}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadge(plan.status)}`}>
                        {plan.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {plan.status === 'scheduled' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updatingStatus[plan.id]}
                            onClick={() => handleUpdatePlanStatus(plan, 'in_progress')}
                          >
                            Start
                          </Button>
                        )}
                        {plan.status === 'in_progress' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updatingStatus[plan.id]}
                            onClick={() => handleUpdatePlanStatus(plan, 'completed')}
                          >
                            Complete
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeletePlan(plan.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No production plans yet. Plans are created automatically from Inventory when you add products or trigger replenishment.
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
