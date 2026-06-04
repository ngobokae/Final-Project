import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { 
  TrendingUp, TrendingDown, Brain, Target, AlertTriangle, 
  Download, RefreshCcw, Filter, Search, BarChart3, ArrowUpRight,
  ArrowDownRight, Calendar, Zap, Activity, LineChart as LineChartIcon,
  Trash2, Upload, CheckCircle, AlertCircle, Loader
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, ComposedChart
} from 'recharts';
import { apiGet, apiPost, apiDelete } from '../../utils/api';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
import { DEMAND_MODELS as DEFAULT_DEMAND_MODELS } from '../../utils/models';
import { darkBlueChartTheme, AreaGradient, axisProps, gridProps, tooltipProps } from '../../utils/chartStyles';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';

export default function DemandForecast() {
  const { confirm } = useConfirmDialog();
  const [timeHorizon, setTimeHorizon] = useState('30d');
  const [selectedModel, setSelectedModel] = useState('ensemble');
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [forecasts, setForecasts] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [demandModels, setDemandModels] = useState([]);
  const [lastInsights, setLastInsights] = useState(null);
  const [forecastAccuracy, setForecastAccuracy] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [uploadError, setUploadError] = useState(null);
  const [uploadedFileInfo, setUploadedFileInfo] = useState(null);
  const [clearing, setClearing] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchDemandModels();
    fetchDashboardMetrics();
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchForecasts();
  }, [selectedProduct, timeHorizon]);

  useEffect(() => {
    const onForecastsUpdated = () => {
      fetchForecasts();
      fetchDashboardMetrics();
    };
    window.addEventListener('app:forecasts-updated', onForecastsUpdated);
    return () => window.removeEventListener('app:forecasts-updated', onForecastsUpdated);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchForecasts();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    const modelsForUI = demandModels.length ? demandModels : DEFAULT_DEMAND_MODELS;
    if (!modelsForUI.length) return;
    if (!modelsForUI.some((m) => m.id === selectedModel)) {
      setSelectedModel(modelsForUI[0].id);
    }
  }, [demandModels, selectedModel]);

  const fetchDemandModels = async () => {
    try {
      const data = await apiGet('/api/demand-models');
      const models = data.models && Array.isArray(data.models) ? data.models : [];
      const finalModels = models.length ? models : DEFAULT_DEMAND_MODELS;
      setDemandModels(finalModels);
      setSelectedModel((prev) => prev || finalModels[0]?.id || 'ensemble');
    } catch (error) {
      console.error('Failed to fetch demand models:', error);
      setDemandModels(DEFAULT_DEMAND_MODELS);
      setSelectedModel((prev) => prev || DEFAULT_DEMAND_MODELS[0]?.id || 'ensemble');
    }
  };

  const fetchDashboardMetrics = async () => {
    try {
      const data = await apiGet('/api/dashboard/stats');
      const raw = data?.stats?.forecast_accuracy;
      const numeric = typeof raw === 'number' ? raw : Number(raw);
      setForecastAccuracy(Number.isFinite(numeric) ? Math.round(numeric) : 0);
    } catch (error) {
      console.error('Failed to fetch dashboard metrics:', error);
      setForecastAccuracy((prev) => prev ?? 0);
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await apiGet('/api/products?limit=100');
      setProducts(data.products || []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const getDaysParam = () => (timeHorizon === '7d' ? 7 : timeHorizon === '30d' ? 30 : timeHorizon === '90d' ? 90 : timeHorizon === '6m' ? 180 : 365);

  const fetchForecasts = async () => {
    try {
      setLoading(true);
      const days = getDaysParam();
      const params = selectedProduct !== 'all' ? `?product_id=${selectedProduct}&days=${days}` : `?days=${days}`;
      const data = await apiGet(`/api/forecast${params}`);
      setForecasts(Array.isArray(data.forecasts) ? data.forecasts : []);
    } catch (error) {
      console.error('Failed to fetch forecasts:', error);
      setForecasts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteForecastRow = async (productId, forecastDate) => {
    const ok = await confirm('Delete this prediction for the selected product and date?', {
      title: 'Delete Prediction',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    try {
      await apiDelete(
        `/api/forecast?product_id=${encodeURIComponent(productId)}&date=${encodeURIComponent(
          forecastDate
        )}`
      );
      await fetchForecasts();
      window.dispatchEvent(new CustomEvent('app:forecasts-updated'));
      window.dispatchEvent(new CustomEvent('app:operations-data-updated'));
    } catch (error) {
      console.error('Failed to delete forecast row:', error);
      alert('Failed to delete this prediction. Please try again.');
    }
  };

  const handleGenerateForecast = async (productId) => {
    try {
      setGenerating(true);
      setLastInsights(null);
      const daysAhead = getDaysParam();
      const result = await apiPost('/api/forecast/generate', {
        product_id: productId,
        days_ahead: daysAhead,
        model_type: selectedModel
      });
      setLastInsights(result?.insights || null);
      window.dispatchEvent(new CustomEvent('app:forecasts-updated'));
      window.dispatchEvent(new Event('app:notifications-changed'));
      await fetchForecasts();
    } catch (error) {
      console.error('Failed to generate forecast:', error);
      alert('Failed to generate forecast. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const ext = file.name.toLowerCase().split('.').pop();
    
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setUploadError('Please upload a CSV or Excel file (.xlsx, .xls, .csv)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setUploadError('File size must be less than 10MB');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      setUploadProgress(0);
      setUploadStage('Uploading file...');
      setUploadedFileInfo(null);

      const formData = new FormData();
      formData.append('file', file);

      // Simulated progress up to 90% during upload
      const progressInterval = setInterval(() => {
        setUploadProgress(p => Math.min(p + 10, 85));
      }, 200);

      const response = await fetch(`${API_BASE_URL}/api/forecast/upload-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(90);
      setUploadStage('Processing ML forecasts...');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      setUploadProgress(100);
      setUploadStage('');
      
      // Store with filename for display
      const uploadInfo = {
        ...result,
        fileName: file.name
      };
      setUploadedFileInfo(uploadInfo);
      
      // Refresh forecasts
      window.dispatchEvent(new CustomEvent('app:forecasts-updated'));
      window.dispatchEvent(new CustomEvent('app:operations-data-updated'));
      
      await fetchForecasts();
      await fetchDashboardMetrics();

      // Reset form
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Clear success message after 10 seconds
      setTimeout(() => {
        setUploadedFileInfo(null);
        setUploadProgress(0);
      }, 10000);
    } catch (error) {
      console.error('File upload error:', error);
      setUploadError(error.message || 'Failed to upload file');
      setUploadProgress(0);
      setUploadStage('');
    } finally {
      setUploading(false);
    }
  };

  const handleClearForecasts = async () => {
    const confirmed = await confirm(
      'Clear All System Data?',
      'This will delete ALL operational data including: forecasts, production plans, procurement orders, sales, inventory, and insights. This prepares the system for a fresh prediction start. You will then upload a new file to generate fresh predictions.'
    );
    
    if (!confirmed) return;

    try {
      setClearing(true);
      setUploadError(null);
      const response = await fetch(`${API_BASE_URL}/api/forecast/clear`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to clear data');
      }

      setUploadedFileInfo(null);
      setUploadProgress(0);
      setUploadStage('');
      setUploadError(null);
      await fetchForecasts();
      await fetchDashboardMetrics();
    } catch (error) {
      console.error('Clear data error:', error);
      setUploadError('Failed to clear data');
    } finally {
      setClearing(false);
    }
  };

  const forecastData = forecasts
    .slice()
    .sort((a, b) => new Date(a.forecast_date) - new Date(b.forecast_date))
    .map((f) => {
      const demand = Number(f.forecasted_demand) || 0;
      const rawConf = f.confidence_level;
      const numericConf =
        typeof rawConf === 'number' ? rawConf : Number(rawConf);
      const confidence =
        Number.isFinite(numericConf) && numericConf > 0 ? numericConf : 0.95;
      const margin = demand * (1 - confidence) * 0.5;
      return {
        month: new Date(f.forecast_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        forecast: demand,
        lowerBound: Math.max(0, Math.round(demand - margin)),
        upperBound: Math.round(demand + margin),
        confidence,
      };
    });

  const trendAnalysisData = forecasts
    .slice()
    .sort((a, b) => new Date(a.forecast_date) - new Date(b.forecast_date))
    .map((f) => {
      const demand = Number(f.forecasted_demand) || 0;
      const trendBase = f.trend_indicator === 'increasing'
        ? demand * 1.1
        : f.trend_indicator === 'decreasing'
          ? demand * 0.9
          : demand;
      return {
        date: new Date(f.forecast_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        forecast: demand,
        trend: Math.round(trendBase),
      };
    });

  const modelsForUI = demandModels.length ? demandModels : DEFAULT_DEMAND_MODELS;

  const modelPerformanceData = modelsForUI.map((model) => ({
    model: model.name,
    accuracy: typeof model.accuracy === 'number' ? model.accuracy : 0,
    active: model.active !== false,
  }));

  const seasonalityData = (() => {
    if (!forecasts.length) return [];
    const buckets = new Map();
    forecasts.forEach((f) => {
      const d = new Date(f.forecast_date);
      if (Number.isNaN(d.getTime())) return;
      const monthKey = d.toLocaleDateString('en-US', { month: 'short' });
      const demand = Number(f.forecasted_demand) || 0;
      const existing = buckets.get(monthKey) || { month: monthKey, total: 0, count: 0 };
      existing.total += demand;
      existing.count += 1;
      buckets.set(monthKey, existing);
    });
    const orderedMonthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return Array.from(buckets.values())
      .map((b) => ({
        month: b.month,
        demand: b.count ? Math.round(b.total / b.count) : 0,
      }))
      .sort(
        (a, b) =>
          orderedMonthNames.indexOf(a.month) - orderedMonthNames.indexOf(b.month)
      );
  })();

  const avgConfidence = forecasts.length > 0
    ? Math.round(
        (forecasts.reduce((sum, f) => {
          const raw = f.confidence_level;
          const numeric = typeof raw === 'number' ? raw : Number(raw);
          const value =
            Number.isFinite(numeric) && numeric > 0 ? numeric : 0.95;
          return sum + value;
        }, 0) / forecasts.length) * 100
      )
    : 0;

  const trackedProductsCount = (() => {
    if (forecasts.length > 0) {
      const ids = new Set();
      forecasts.forEach((f) => {
        if (f.product_id != null) ids.add(f.product_id);
      });
      return ids.size;
    }
    return 0;
  })();

  const activeModels = modelPerformanceData.filter((m) => m.active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <LineChartIcon className="w-7 h-7 text-emerald-600" />
            Demand Forecast (Predict 2 – Demand)
          </h1>
          <p className="text-gray-500 mt-1">Predict 2 for demand – AI-powered demand predictions with confidence intervals</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchForecasts} disabled={loading}>
            <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* File Upload Section */}
      <Card className="border-emerald-200 bg-emerald-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-600" />
              <div>
                <CardTitle>Upload Forecast Data</CardTitle>
                <CardDescription>Import CSV or Excel files with historical inventory data to generate AI predictions</CardDescription>
              </div>
            </div>
            <Button 
              onClick={handleClearForecasts}
              variant="outline"
              size="sm"
              disabled={clearing}
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {clearing ? 'Clearing...' : 'Clear All System Data'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Upload Area */}
            <div
              className="border-2 border-dashed border-emerald-300 rounded-lg p-8 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-100 transition"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-emerald-600" />
                <p className="font-medium text-gray-700">
                  {uploading ? 'Uploading...' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-sm text-gray-500">CSV or Excel files (.csv, .xlsx, .xls)</p>
                <p className="text-xs text-gray-400">Maximum file size: 10MB</p>
              </div>
            </div>

            {/* Upload Progress */}
            {uploading && uploadProgress > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 font-medium">{uploadStage || 'Processing...'}</span>
                  <span className="font-medium text-emerald-600">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            {uploadError && (
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">Upload Error</p>
                  <p className="text-sm text-red-700">{uploadError}</p>
                </div>
              </div>
            )}

            {/* Success Message */}
            {uploadedFileInfo && (
              <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-green-900">✓ Upload Successful!</p>
                  <p className="text-sm text-green-700 mt-2">
                    <strong>File:</strong> {uploadedFileInfo.fileName}
                  </p>
                  <p className="text-sm text-green-700">
                    <strong>Forecasts:</strong> {uploadedFileInfo.forecastsGenerated} generated from {uploadedFileInfo.fileInfo?.rowCount} rows
                  </p>
                  <p className="text-xs text-green-600 mt-2">To upload a new file for predictions, click "Clear All System Data" button above first</p>
                </div>
              </div>
            )}

            {/* File Format Guide */}
            <div className="bg-white p-4 rounded-lg text-sm text-gray-600">
              <p className="font-medium text-gray-900 mb-2">File Format Requirements:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Column 1: Product ID, SKU, or Name (identifier)</li>
                <li>Column 2: Quantity or Units</li>
                <li>Optional: Date, Region, Category</li>
                <li>First row should contain headers</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Forecast Accuracy</CardTitle>
            <Target className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {forecastAccuracy != null && forecastAccuracy > 0 ? `${forecastAccuracy}%` : 'N/A'}
            </div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              <span>
                {forecastAccuracy != null && forecastAccuracy > 0
                  ? 'Based on last 30 days'
                  : 'No accuracy data yet'}
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Confidence</CardTitle>
            <Brain className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {forecasts.length > 0 ? `${avgConfidence}%` : 'N/A'}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {forecasts.length > 0 ? 'Across all products' : 'No forecast data'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products Tracked</CardTitle>
            <BarChart3 className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trackedProductsCount}</div>
            <p className="text-xs text-gray-500 mt-1">
              {forecasts.length > 0 ? 'With active forecasts' : 'Products in catalog'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Model Status</CardTitle>
            <Activity className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${activeModels.length > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {activeModels.length > 0 ? 'Active' : 'Unavailable'}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {modelsForUI.length > 0
                ? `${activeModels.length} of ${modelsForUI.length} model${modelsForUI.length === 1 ? '' : 's'} enabled`
                : 'No models configured'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Forecast Configuration</CardTitle>
          <CardDescription>Adjust parameters to customize your forecasts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Time Horizon</Label>
              <Select value={timeHorizon} onValueChange={setTimeHorizon}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 Days</SelectItem>
                  <SelectItem value="30d">30 Days</SelectItem>
                  <SelectItem value="90d">90 Days</SelectItem>
                  <SelectItem value="6m">6 Months</SelectItem>
                  <SelectItem value="12m">12 Months</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>AI Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelsForUI.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Product Filter</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {products.map(product => (
                    <SelectItem key={product.id} value={product.id.toString()}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="forecasts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
          <TabsTrigger value="trends">Trend Analysis</TabsTrigger>
          <TabsTrigger value="performance">Model Performance</TabsTrigger>
          <TabsTrigger value="seasonality">Seasonality</TabsTrigger>
        </TabsList>

        {/* Forecasts Tab */}
        <TabsContent value="forecasts" className="space-y-4">
          {lastInsights && (
            <Card>
              <CardHeader>
                <CardTitle>Latest Prediction Insights</CardTitle>
                <CardDescription>Summary from the last generated forecast</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg border bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700">
                    <div className="text-xs text-gray-500">Avg Historical Demand</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {lastInsights.average_historical_demand ?? '—'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700">
                    <div className="text-xs text-gray-500">Avg Forecast Demand</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {lastInsights.average_forecasted_demand ?? '—'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700">
                    <div className="text-xs text-gray-500">Trend</div>
                    <div className="text-lg font-semibold text-gray-900 capitalize">
                      {lastInsights.trend_direction ?? '—'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedProduct !== 'all' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Predict 2 – Demand</CardTitle>
                    <CardDescription>Create new demand forecast for selected product</CardDescription>
                  </div>
                  <Button 
                    onClick={() => handleGenerateForecast(parseInt(selectedProduct))}
                    disabled={generating}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {generating ? (
                      <>
                        <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Run Predict 2 (Demand)
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
            </Card>
          )}

          {forecastData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Forecast Visualization</CardTitle>
                <CardDescription>Demand forecast with confidence intervals</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]" style={{ backgroundColor: darkBlueChartTheme.background, borderRadius: '8px', padding: '16px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={forecastData}>
                      <AreaGradient id="forecastDemand" />
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="month" {...axisProps} />
                      <YAxis {...axisProps} />
                      <Tooltip {...tooltipProps} />
                      <Area 
                        type="monotone" 
                        dataKey="forecast" 
                        stroke={darkBlueChartTheme.lineColor}
                        strokeWidth={2}
                        fill="url(#areaGradient-forecastDemand)"
                        fillOpacity={darkBlueChartTheme.areaFillOpacity}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle>Previous predictions</CardTitle>
                <CardDescription>
                  All stored forecasts for the selected period (by forecast date). Use &quot;Refresh&quot; after
                  running Predict 2 (Sales) to see new data.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {forecasts.length > 0 ? (
                <div className="overflow-x-auto max-h-[30rem] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 dark:bg-neutral-800/50 dark:border-neutral-600">
                        <th className="text-left py-3 px-3 font-medium text-gray-700">Forecast date</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-700">Product</th>
                        <th className="text-right py-3 px-3 font-medium text-gray-700">Predicted demand</th>
                        <th className="text-right py-3 px-3 font-medium text-gray-700">Confidence</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-700">Trend</th>
                        <th className="text-right py-3 px-3 font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecasts.map((f, index) => (
                        <tr key={`${f.product_id}-${f.forecast_date}-${index}`} className="border-b hover:bg-gray-50 dark:hover:bg-neutral-800/50 dark:border-neutral-600">
                          <td className="py-2 px-3">{new Date(f.forecast_date).toLocaleDateString()}</td>
                          <td className="py-2 px-3 font-medium">{f.product_name || f.sku || `Product ${f.product_id}`}</td>
                          <td className="py-2 px-3 text-right">{Number(f.forecasted_demand).toLocaleString()} units</td>
                          <td className="py-2 px-3 text-right">{Math.round((f.confidence_level ?? 0.95) * 100)}%</td>
                          <td className="py-2 px-3">
                            <Badge variant={f.trend_indicator === 'increasing' ? 'default' : 'secondary'}>
                              {f.trend_indicator === 'increasing' ? '↗ Increasing' : f.trend_indicator === 'decreasing' ? '↘ Decreasing' : '→ Stable'}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleDeleteForecastRow(f.product_id, f.forecast_date)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 text-gray-500">
                  <p className="font-medium">No predictions in this period.</p>
                  <p className="text-sm mt-1">Run Predict 2 (Sales) on the Sales Data page, or generate a forecast for a product below. Then click Refresh.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Product Forecasts (summary)</CardTitle>
              <CardDescription>Summary of demand predictions by product</CardDescription>
            </CardHeader>
            <CardContent>
              {forecasts.length > 0 ? (
                <div className="max-h-[34rem] overflow-y-auto space-y-4 pr-2">
                  {forecasts.slice(0, 20).map((forecast, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 dark:border-neutral-600 transition-colors">
                      <div>
                        <h4 className="font-medium">{forecast.product_name || 'Product'}</h4>
                        <p className="text-sm text-gray-500">
                          Forecast: {forecast.forecasted_demand} units • Confidence: {Math.round((forecast.confidence_level || 0.95) * 100)}%
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={forecast.trend_indicator === 'increasing' ? 'default' : 'secondary'}>
                          {forecast.trend_indicator === 'increasing' ? '↗ Increasing' : forecast.trend_indicator === 'decreasing' ? '↘ Decreasing' : '→ Stable'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">No forecasts. Run Predict 2 (Sales) or generate below, then Refresh.</p>
              )}
              {forecasts.length > 20 && (
                <p className="mt-3 text-xs text-gray-500">Showing first 20 items. Scroll to review the summary and adjust the time horizon for more.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trend Analysis Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trend Analysis</CardTitle>
              <CardDescription>Analyze demand trends and patterns over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]" style={{ backgroundColor: darkBlueChartTheme.background, borderRadius: '8px', padding: '16px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendAnalysisData}>
                    <AreaGradient id="trendAnalysis" />
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="date" {...axisProps} />
                    <YAxis {...axisProps} />
                    <Tooltip {...tooltipProps} />
                    <Area 
                      type="monotone" 
                      dataKey="forecast" 
                      stroke={darkBlueChartTheme.lineColor}
                      strokeWidth={2}
                      fill="url(#areaGradient-trendAnalysis)"
                      fillOpacity={darkBlueChartTheme.areaFillOpacity}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Model Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Performance</CardTitle>
              <CardDescription>Compare accuracy metrics across different forecasting models</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]" style={{ backgroundColor: darkBlueChartTheme.background, borderRadius: '8px', padding: '16px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={modelPerformanceData}>
                    <AreaGradient id="modelPerformance" />
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="model" {...axisProps} />
                    <YAxis {...axisProps} />
                    <Tooltip {...tooltipProps} />
                    <Area
                      type="monotone"
                      dataKey="accuracy"
                      stroke={darkBlueChartTheme.lineColor}
                      strokeWidth={2}
                      fill="url(#areaGradient-modelPerformance)"
                      fillOpacity={darkBlueChartTheme.areaFillOpacity}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {modelPerformanceData.map((model, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{model.model}</h4>
                      <p className="text-sm text-gray-500">
                        Accuracy:{' '}
                        {model.accuracy != null && model.accuracy > 0
                          ? `${model.accuracy}%`
                          : 'N/A'}{' '}
                        • Status: {model.active ? 'Active' : 'Disabled'}
                      </p>
                    </div>
                    {model.model === 'Ensemble' && (
                      <Badge className="bg-green-100 text-green-800">Best</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Seasonality Tab */}
        <TabsContent value="seasonality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Seasonal Patterns</CardTitle>
              <CardDescription>Identify seasonal demand patterns throughout the year</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={seasonalityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="demand" 
                      stroke="#10b981" 
                      fill="#10b981" 
                      fillOpacity={0.2}
                      name="Demand"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
