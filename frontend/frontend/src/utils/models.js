// Shared definition of available AI models,
// used by admin AI Models page and operations prediction flows.

export const ALLOWED_DEMAND_MODEL_IDS = ['ensemble', 'prophet', 'lstm'];

export const DEMAND_MODELS = [
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
];
