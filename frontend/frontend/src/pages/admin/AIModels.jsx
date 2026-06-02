import { useEffect, useMemo, useState } from 'react';
import { Brain, CheckCircle, AlertCircle, Plus, Save, Trash2, RefreshCw } from 'lucide-react';
import { apiGet, apiPut } from '../../utils/api';
import { DEMAND_MODELS as DEFAULT_DEMAND_MODELS } from '../../utils/models';

export default function AIModels() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'Time Series',
    description: '',
    accuracy: '',
    active: true,
  });

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

  const saveModels = async (nextModels) => {
    try {
      setSaving(true);
      await apiPut('/api/admin/demand-models', { models: nextModels });
      setModels(nextModels);
      return true;
    } catch (error) {
      console.error('Failed to save models:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  // ✅ UPDATED: Auto-save when toggling active status
  const toggleActive = async (id) => {
    const next = models.map((m) => (m.id === id ? { ...m, active: !m.active } : m));
    
    try {
      setSaving(true);
      await apiPut('/api/admin/demand-models', { models: next });
      setModels(next);
      // Silent success - no alert needed for quick toggles
    } catch (error) {
      console.error('Failed to save model status:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ✅ UPDATED: Auto-save when removing a model
  const removeModel = async (id) => {
    if (!confirm('Are you sure you want to delete this model? This action cannot be undone.')) {
      return;
    }
    
    const next = models.filter((m) => m.id !== id);
    
    try {
      setSaving(true);
      await apiPut('/api/admin/demand-models', { models: next });
      setModels(next);
      alert('Model deleted successfully!');
    } catch (error) {
      console.error('Failed to delete model:', error);
      alert('Failed to delete model. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ✅ UPDATED: Auto-save when adding a new model
  const addModel = async () => {
    const accuracy = form.accuracy !== '' ? Number(form.accuracy) : null;
    const next = [
      ...models,
      {
        id: `custom-${Date.now()}`,
        name: form.name.trim(),
        type: form.type.trim(),
        description: form.description.trim(),
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
        active: Boolean(form.active),
      },
    ];
    
    try {
      setSaving(true);
      await apiPut('/api/admin/demand-models', { models: next });
      setModels(next);
      setShowModal(false);
      setForm({ name: '', type: 'Time Series', description: '', accuracy: '', active: true });
      alert('Model added and saved successfully!');
    } catch (error) {
      console.error('Failed to save model:', error);
      alert('Model created but failed to save. Please click "Save Changes" manually.');
      // Still update UI even if save fails
      setModels(next);
      setShowModal(false);
      setForm({ name: '', type: 'Time Series', description: '', accuracy: '', active: true });
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
            Create demand forecasting models. Operations will choose one before running predictions.
          </p>
          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Auto-save enabled - Changes are saved automatically
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
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
          >
            <Plus className="w-4 h-4" />
            Add Model
          </button>
          <button
            onClick={() => saveModels(models)}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            title="Manual save (changes are auto-saved, but you can use this to force a save)"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Manual Save'}
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

            <div className="flex gap-2">
              <button
                onClick={() => toggleActive(model.id)}
                disabled={saving}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  model.active
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {model.active ? 'Disable' : 'Enable'}
              </button>
              <button
                onClick={() => removeModel(model.id)}
                disabled={saving}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-lg mx-4 border border-gray-200 dark:border-neutral-700">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Add Demand Model</h2>
              <p className="text-sm text-gray-500 mt-1">This model will appear in Operations "Run Predictions".</p>
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Will be saved automatically when you click Add
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. LSTM v2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <input
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Time Series / Deep Learning"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Accuracy (optional)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.accuracy}
                    onChange={(e) => setForm((p) => ({ ...p, accuracy: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                    />
                    Active
                  </label>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-800 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={addModel}
                disabled={!form.name.trim() || saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Add & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}