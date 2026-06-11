import dotenv from 'dotenv';
import { query } from './config/database.js';

dotenv.config();

const THREE_MODELS = JSON.stringify([
  {
    id: 'ensemble',
    name: 'Ensemble (Best)',
    type: 'Hybrid',
    description: 'Combines Prophet and LSTM models for robust demand forecasts.',
    accuracy: 96.2,
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
      ['demand_models', THREE_MODELS]
    );
    console.log('✓ Updated to 3 models (ensemble, prophet, lstm)');

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
