// Shared definition of available AI models,
// used by admin AI Models page and operations prediction flows.

export const DEMAND_MODELS = [
  {
    id: 'baseline',
    name: 'Fast baseline',
    type: 'Statistical',
    description: 'Quick moving-average forecast. Best for bulk Predict 2 runs.',
    accuracy: 82.0,
    active: true,
  },
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
];

