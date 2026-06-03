// Shared chart styling configuration that adapts to dark mode
// Detects dark mode and returns appropriate colors

const isDarkMode = () => {
  if (typeof window === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
};

export const getChartTheme = () => {
  const dark = isDarkMode();
  return {
    // Background colors
    background: dark ? '#1a1a1a' : '#ffffff',
    cardBackground: dark ? '#1a1a1a' : '#ffffff',
    
    // Grid and axes
    gridColor: dark ? '#404040' : '#e5e7eb',
    axisColor: dark ? '#9ca3af' : '#6b7280',
    axisLabelColor: dark ? '#e5e7eb' : '#374151',
    
    // Data line
    lineColor: dark ? '#60a5fa' : '#3b82f6', // Lighter blue in dark mode
    lineStrokeWidth: 2,
    
    // Area fill gradient
    areaFillStart: dark ? '#60a5fa' : '#3b82f6',
    areaFillEnd: dark ? '#1e3a8a' : '#dbeafe',
    areaFillOpacity: dark ? 0.4 : 0.6,
    
    // Tooltip
    tooltipBg: dark ? '#2a2a2a' : '#ffffff',
    tooltipBorder: dark ? '#404040' : '#e5e7eb',
    tooltipText: dark ? '#e5e7eb' : '#111827',
  };
};

export const darkBlueChartTheme = getChartTheme();

// Gradient definition for area fill (updates with theme)
export const AreaGradient = ({ id, dataKey }) => {
  const theme = getChartTheme();
  return (
    <defs>
      <linearGradient id={`areaGradient-${dataKey || id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={theme.areaFillStart} stopOpacity={0.8} />
        <stop offset="100%" stopColor={theme.areaFillEnd} stopOpacity={0.2} />
      </linearGradient>
    </defs>
  );
};

export const ForecastGradient = ({ id }) => {
  return (
    <defs>
      <linearGradient id={`areaGradient-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8884d8" stopOpacity={0.8} />
        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.2} />
      </linearGradient>
    </defs>
  );
};

// Common axis props (updates with theme)
export const getAxisProps = () => {
  const theme = getChartTheme();
  return {
    stroke: theme.axisColor,
    strokeWidth: 1,
    tick: { fill: theme.axisLabelColor, fontSize: 12 },
    label: { fill: theme.axisLabelColor, fontSize: 12 },
  };
};

// Common grid props (updates with theme)
export const getGridProps = () => {
  const theme = getChartTheme();
  return {
    stroke: theme.gridColor,
    strokeWidth: 1,
    strokeOpacity: 0.3,
    strokeDasharray: '3 3',
  };
};

// Common tooltip props (updates with theme)
export const getTooltipProps = () => {
  const theme = getChartTheme();
  return {
    contentStyle: {
      backgroundColor: theme.tooltipBg,
      border: `1px solid ${theme.tooltipBorder}`,
      borderRadius: '6px',
      color: theme.tooltipText,
    },
    labelStyle: { color: theme.tooltipText },
  };
};

// Brand-aligned categorical palette for charts (mirrors the --color-chart-*
// tokens in index.css). Red-led and neutral-anchored so charts read as part of
// the KINGLION brand instead of a random rainbow. Use by index, cycling.
export const CHART_COLORS = [
  '#dc2626', // brand red
  '#f59e0b', // amber
  '#16a34a', // green
  '#6b7280', // neutral gray (legible on light + dark)
  '#3b82f6', // blue
  '#8b5cf6', // violet
];

// Semantic chart colors for meaning-bearing series.
export const CHART_SEMANTIC = {
  positive: '#16a34a',
  negative: '#dc2626',
  warning: '#f59e0b',
  info: '#3b82f6',
  neutral: '#6b7280',
};

// Legacy exports for backward compatibility (use theme-aware versions)
export const axisProps = getAxisProps();
export const gridProps = getGridProps();
export const tooltipProps = getTooltipProps();

