// Shared definition of available AI models,
// used by admin AI Models page and operations prediction flows.

export const DEMAND_MODELS = [
  {
    id: 'ensemble',
    name: 'Ensemble (Best)',
    type: 'Time Series',
    description: 'Combines multiple algorithms (ARIMA, Prophet, LSTM) for robust demand forecasts.',
    accuracy: 96.2,
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
  {
    id: 'prophet',
    name: 'Prophet',
    type: 'Time Series',
    description: 'Decomposable time series model, strong for business seasonality.',
    accuracy: 91.8,
    active: true,
  },
];

