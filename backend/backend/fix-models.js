import dotenv from 'dotenv';
import { query } from './config/database.js';

dotenv.config();

const FIVE_MODELS = JSON.stringify([
  {
    id: 'ensemble',
    name: 'Ensemble (Best)',
    type: 'Hybrid',
    description: 'Combines ARIMA, Prophet, Random Forest, and LSTM models for robust demand forecasts.',
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
]);

async function fixModels() {
  try {
    console.log('Updating demand_models in system_settings...');
    await query(
      `INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description)
       VALUES (?, ?, 'json', 'ml', 'Demand forecast models')
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      ['demand_models', FIVE_MODELS]
    );
    console.log('✓ Updated to 5 models');
    
    // Verify
    const result = await query(
      'SELECT setting_value FROM system_settings WHERE setting_key = ?',
      ['demand_models']
    );
    const stored = JSON.parse(result[0].setting_value);
    console.log(`✓ Verified: ${stored.length} models now stored in database`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

fixModels();
