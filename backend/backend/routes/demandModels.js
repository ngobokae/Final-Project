import { query } from '../config/database.js';
import { parseBody, sendJSON, sendError } from '../utils/helpers.js';

const SETTING_KEY = 'demand_models';

const DEFAULT_MODELS = [
  {
    id: 'ensemble',
    name: 'Ensemble (Best)',
    type: 'Hybrid',
    description: 'Combines ARIMA, Prophet, Random Forest, and LSTM models for robust demand forecasting.',
    accuracy: 96.2,
    active: true,
  },
  {
    id: 'arima',
    name: 'ARIMA',
    type: 'Time Series',
    description: 'Autoregressive Integrated Moving Average model for trend and seasonality.',
    accuracy: 93.5,
    active: true,
  },
  {
    id: 'prophet',
    name: 'Prophet',
    type: 'Time Series',
    description: 'Additive decomposable model designed for business seasonality.',
    accuracy: 92.4,
    active: true,
  },
  {
    id: 'random_forest',
    name: 'Random Forest',
    type: 'Machine Learning',
    description: 'Tree-based model that learns demand patterns from lagged sales features.',
    accuracy: 90.3,
    active: true,
  },
  {
    id: 'lstm',
    name: 'LSTM Neural Network',
    type: 'Deep Learning',
    description: 'Sequence model optimized for complex seasonal and trend patterns.',
    accuracy: 94.5,
    active: true,
  },
];

const slugify = (value) => {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
};

const normalizeModels = (models) => {
  if (!Array.isArray(models)) return [];

  const normalized = [];
  const seen = new Set();

  for (const m of models) {
    if (!m || typeof m !== 'object') continue;

    const id = slugify(m.id || m.name);
    if (!id || seen.has(id)) continue;

    const name = String(m.name || id).trim();
    if (!name) continue;

    normalized.push({
      id,
      name,
      type: String(m.type || 'Time Series'),
      description: String(m.description || ''),
      accuracy: Number.isFinite(Number(m.accuracy)) ? Number(m.accuracy) : null,
      active: Boolean(m.active !== false),
    });
    seen.add(id);
  }

  return normalized;
};

const readStoredModels = async () => {
  const rows = await query('SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1', [SETTING_KEY]);
  if (!rows.length) return DEFAULT_MODELS;

  try {
    const parsed = JSON.parse(rows[0].setting_value);
    const models = normalizeModels(parsed);
    return models.length ? models : DEFAULT_MODELS;
  } catch {
    return DEFAULT_MODELS;
  }
};

const writeStoredModels = async (userId, models) => {
  const value = JSON.stringify(models);
  await query(
    `
    INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description, updated_by)
    VALUES (?, ?, 'json', 'ml', 'Demand forecast models', ?)
    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), setting_type = VALUES(setting_type), category = VALUES(category), updated_by = VALUES(updated_by)
    `,
    [SETTING_KEY, value, userId || null]
  );
};

// GET /api/demand-models?all=true
export const handleGetDemandModels = async (req, res) => {
  try {
    const queryParams = req.query || {};
    const includeAll = queryParams.all === 'true';

    const models = await readStoredModels();
    const activeModels = models.filter((m) => m.active);

    sendJSON(res, 200, {
      models: includeAll ? models : activeModels,
      allCount: models.length,
      activeCount: activeModels.length,
    });
  } catch (error) {
    console.error('Get demand models error:', error);
    sendError(res, 500, 'Failed to fetch demand models');
  }
};

// PUT /api/admin/demand-models  { models: [...] }
export const handleUpdateDemandModels = async (req, res) => {
  try {
    const body = await parseBody(req);
    const input = body.models ?? body.demand_models ?? body.demandModels;

    const models = normalizeModels(input);
    if (!models.length) {
      return sendError(res, 400, 'Invalid models list');
    }

    await writeStoredModels(req.user?.id, models);
    sendJSON(res, 200, { success: true, models });
  } catch (error) {
    console.error('Update demand models error:', error);
    sendError(res, 500, 'Failed to update demand models');
  }
};

