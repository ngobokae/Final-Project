import { useEffect, useMemo, useState } from 'react';
import { Brain, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { apiGet, apiPut } from '../../utils/api';
import { DEMAND_MODELS as DEFAULT_DEMAND_MODELS } from '../../utils/models';

export default function AIModels() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => {
    const total = models.length;
    const active = models.filter((m) => m.active).length;
    const accuracies = models.map((m) => Number(m.accuracy)).filter((n) => Number.isFinite(n));
    const avgAccuracy = accuracies.length ? (accuracies.reduce((a, b) => a + b, 0) / accuracies.length) : null;
    return { total, active, avgAccuracy };
  }, [models]);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const data = await apiGet('/api/demand-models?all=true');
      const list = Array.isArray(data.models) && data.models.length ? data.models : DEFAULT_DEMAND_MODELS;
      setModels(list);
    } catch (error) {
      console.error('Failed to fetch demand models:', error);
      setModels(DEFAULT_DEMAND_MODELS);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id) => {
    const next = models.map((m) => (m.id === id ? { ...m, active: !m.active } : m));

    try {
      setSaving(true);
      await apiPut('/api/admin/demand-models', { models: next });
      setModels(next);
    } catch (error) {
      console.error('Failed to save model status:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getActiveBadge = (active) => {
    return active ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border bg-green-100 text-green-800 border-green-200">
        <CheckCircle className="w-3 h-3" />
        Active
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border bg-gray-100 text-gray-800 border-gray-200">
        <AlertCircle className="w-3 h-3" />
        Inactive
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="w-7 h-7 text-blue-600" />
            AI Models
          </h1>
          <p className="text-gray-500 mt-1">
            Manage the three demand forecasting models: Ensemble, Prophet, and LSTM.
          </p>
          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Auto-save enabled — changes are saved automatically
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchModels}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
          <div className="text-sm text-gray-500">Total Models</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
          <div className="text-sm text-gray-500">Active Models</div>
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
          <div className="text-sm text-gray-500">Avg Accuracy</div>
          <div className="text-2xl font-bold text-blue-600">{stats.avgAccuracy ? `${stats.avgAccuracy.toFixed(1)}%` : '—'}</div>
        </div>
      </div>

      {saving && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-blue-700">Saving changes...</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {models.map((model) => (
          <div
            key={model.id}
            className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{model.name}</h3>
                  <p className="text-sm text-gray-500">{model.type}</p>
                </div>
              </div>
              {getActiveBadge(Boolean(model.active))}
            </div>

            <p className="text-sm text-gray-600 mb-4">{model.description || '—'}</p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-3">
                <div className="text-xs text-gray-500">Model ID</div>
                <div className="text-sm font-mono text-gray-900">{model.id}</div>
              </div>
              <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-3">
                <div className="text-xs text-gray-500">Accuracy</div>
                <div className="text-lg font-bold text-gray-900">
                  {model.accuracy !== null && model.accuracy !== undefined ? `${Number(model.accuracy).toFixed(1)}%` : '—'}
                </div>
              </div>
            </div>

            <button
              onClick={() => toggleActive(model.id)}
              disabled={saving}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                model.active
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {model.active ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
