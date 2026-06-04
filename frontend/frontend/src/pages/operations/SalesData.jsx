import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
  Upload, FileText, Download, TrendingUp, DollarSign, Package, BarChart3,
  Search, Filter, Calendar, Eye, RefreshCcw, CheckCircle, AlertCircle,
  Trash2
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, PieChart, Pie, Cell
} from 'recharts';
import { apiGet, apiPost, apiDelete, API_BASE_URL } from '../../utils/api';
import { DEMAND_MODELS as DEFAULT_DEMAND_MODELS } from '../../utils/models';
import { formatCurrency } from '../../utils/currency';
import { darkBlueChartTheme, AreaGradient, ForecastGradient, axisProps, gridProps, tooltipProps } from '../../utils/chartStyles';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';

export default function SalesData() {
  const { confirm } = useConfirmDialog();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState('all');
  const [filterProduct, setFilterProduct] = useState('all');
  const [dateRange, setDateRange] = useState('1y');
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [predictProgress, setPredictProgress] = useState({ current: 0, total: 0 });
  const [demandModels, setDemandModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState('baseline');
  const [uploadedFiles, setUploadedFiles] = useState(() => {
    try {
      const saved = localStorage.getItem('sales_uploaded_files');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [apiError, setApiError] = useState(null);
  const fileInputRef = useRef(null);
  const predictSectionRef = useRef(null);
  const [forecastMetrics, setForecastMetrics] = useState(null);
  const [salesTrendData, setSalesTrendData] = useState([]);

  useEffect(() => {
    fetchSalesData();
    fetchProducts();
  }, [dateRange, filterProduct, filterRegion]);

  useEffect(() => {
    try {
      localStorage.setItem('sales_uploaded_files', JSON.stringify(uploadedFiles));
    } catch (_) {}
  }, [uploadedFiles]);

  // Only keep uploads that actually imported rows (so predict stays tied to real documents)
  useEffect(() => {
    setUploadedFiles((prev) => prev.filter((f) => Number(f.records) > 0));
  }, []);

  useEffect(() => {
    fetchDemandModels();
  }, []);

  useEffect(() => {
    const onUpdate = () => fetchSalesData(null, false);
    window.addEventListener('app:forecasts-updated', onUpdate);
    window.addEventListener('app:operations-data-updated', onUpdate);
    return () => {
      window.removeEventListener('app:forecasts-updated', onUpdate);
      window.removeEventListener('app:operations-data-updated', onUpdate);
    };
  }, []);

  const fetchDemandModels = async () => {
    try {
      const data = await apiGet('/api/demand-models');
      const models = data.models && Array.isArray(data.models) ? data.models : [];
      const finalModels = models.length ? models : DEFAULT_DEMAND_MODELS;
      setDemandModels(finalModels);
      setSelectedModelId((prev) => prev || finalModels[0]?.id || '');
    } catch (error) {
      console.error('Failed to fetch demand models:', error);
      setDemandModels(DEFAULT_DEMAND_MODELS);
      setSelectedModelId((prev) => prev || DEFAULT_DEMAND_MODELS[0]?.id || 'ensemble');
    }
  };

  const fetchSalesData = async (dateRangeOverride, silent = false) => {
    try {
      if (!silent) setLoading(true);
      setApiError(null);
      const params = new URLSearchParams();
      const rangeToUse = dateRangeOverride ?? dateRange;
      const days = rangeToUse === '7d' ? 7 : rangeToUse === '30d' ? 30 : rangeToUse === '90d' ? 90 : 730;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      params.append('start_date', startDate);
      if (filterProduct !== 'all') params.append('product_id', filterProduct);
      if (filterRegion !== 'all') params.append('region', filterRegion);

      const data = await apiGet(`/api/sales?${params.toString()}`);
      setSales(data.sales || []);

      const statsData = await apiGet(`/api/sales/stats?days=${days}`);
      setStats(statsData || null);

      // Fetch forecast metrics in parallel
      const forecastData = await apiGet(`/api/forecast?days=30`).catch(() => ({ forecasts: [] }));
      const forecasts = Array.isArray(forecastData.forecasts) ? forecastData.forecasts : [];

      // Build chart series from both actual sales AND forecasts
      const combinedByDate = new Map();
      
      // 1. Add historical sales
      (data.sales || []).forEach((s) => {
        const dateKey = new Date(s.sale_date).toISOString().split('T')[0];
        const entry = combinedByDate.get(dateKey) || { date: dateKey, revenue: 0, units: 0, forecastRevenue: null };
        entry.revenue += Number(s.total_amount) || 0;
        entry.units += Number(s.quantity) || 0;
        combinedByDate.set(dateKey, entry);
      });

      // 2. Add future forecasts
      forecasts.forEach((f) => {
        const dateKey = new Date(f.forecast_date).toISOString().split('T')[0];
        const entry = combinedByDate.get(dateKey) || { date: dateKey, revenue: null, units: null, forecastRevenue: 0 };
        const price = Number(f.unit_price ?? f.unit_cost) || 0;
        entry.forecastRevenue += (Number(f.forecasted_demand) || 0) * price;
        combinedByDate.set(dateKey, entry);
      });

      setSalesTrendData(
        Array.from(combinedByDate.values())
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .map((item) => ({
            month: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            revenue: item.revenue,
            forecastRevenue: item.forecastRevenue,
          }))
      );

      await fetchForecastMetrics(days);
    } catch (error) {
      console.error('Failed to fetch sales data:', error);
      const msg = error?.message || '';
      setApiError(msg.includes('fetch') || msg.includes('refused') || msg.includes('Failed to fetch')
        ? 'Cannot reach the backend. Start the backend (e.g. node server.js in the backend folder on port 3001) and refresh.'
        : 'Failed to load sales data. Try again.');
    } finally {
      if (!silent) setLoading(false);
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

  const fetchForecastMetrics = async (days) => {
    try {
      const data = await apiGet(`/api/forecast?days=${days}`);
      const forecasts = Array.isArray(data.forecasts) ? data.forecasts : [];
      if (!forecasts.length) {
        setForecastMetrics(null);
        return;
      }

      let totalUnits = 0;
      let totalRevenue = 0;
      const byProduct = new Map();
      const byDate = new Map();
      const records = [];

      forecasts.forEach((f) => {
        const qty = Number(f.forecasted_demand) || 0;
        const price = Number(f.unit_price ?? f.unit_cost) || 0;
        const revenue = qty * price;
        totalUnits += qty;
        totalRevenue += revenue;

        const key = f.product_name || `Product ${f.product_id}`;
        const entry = byProduct.get(key) || { name: key, revenue: 0, units: 0 };
        entry.revenue += revenue;
        entry.units += qty;
        byProduct.set(key, entry);

        const dateKey = new Date(f.forecast_date).toISOString().split('T')[0];
        const dateEntry =
          byDate.get(dateKey) || { date: dateKey, total_revenue: 0, total_units: 0 };
        dateEntry.total_revenue += revenue;
        dateEntry.total_units += qty;
        byDate.set(dateKey, dateEntry);

        records.push({
          id: `forecast-${f.product_id}-${f.forecast_date}`,
          sale_date: f.forecast_date,
          product_name: f.product_name || `Product ${f.product_id}`,
          quantity: qty,
          unit_price: price,
          total_amount: revenue,
          customer_name: 'Forecast',
          region: 'Forecast',
        });
      });

      setForecastMetrics({
        totalUnits,
        totalRevenue,
        totalRecords: forecasts.length,
        byProduct: Array.from(byProduct.values()),
        byDate: Array.from(byDate.values()).sort(
          (a, b) => new Date(a.date) - new Date(b.date)
        ),
        records,
      });
    } catch (error) {
      console.error('Failed to fetch forecast metrics:', error);
      setForecastMetrics(null);
    }
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/sales/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      let data = {};
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (_) {
        data = { error: response.statusText || 'Invalid response from server' };
      }

      if (response.ok && data.success) {
        const processed = data.recordsProcessed || 0;
        setActiveTab('upload');
        if (processed > 0) {
          const newEntries = Array.from(files).map((file) => ({
            name: file.name,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            records: processed,
          }));
          setUploadedFiles((prev) => [...newEntries, ...prev]);
        }
        setDateRange('1y');
        if (Array.isArray(data.sales)) setSales(data.sales);
        if (data.stats != null) setStats(data.stats);
        await fetchSalesData('1y', true);
        if (processed > 0) {
          window.dispatchEvent(new CustomEvent('app:toast', { 
            detail: { 
              type: 'success', 
              title: 'Upload Successful', 
              description: data.message || `Processed ${processed} records successfully.` 
            } 
          }));
          setTimeout(() => predictSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
        } else {
          const debugCols = data.debug?.columns?.join(', ') || '';
          window.dispatchEvent(new CustomEvent('app:toast', { 
            detail: { 
              type: 'warning', 
              title: 'No rows imported', 
              description: data.message || `File read but 0 sales saved.${debugCols ? ` Columns: ${debugCols}` : ''} Use product SKU/name, date, quantity, and unit_price.` 
            } 
          }));
        }
      } else {
        const errMsg = data.error || data.message || `Upload failed (${response.status}). Please check your file and try again.`;
        window.dispatchEvent(new CustomEvent('app:toast', { 
          detail: { type: 'error', title: 'Upload Failed', description: errMsg } 
        }));
      }
    } catch (error) {
      console.error('Upload error:', error);
      window.dispatchEvent(new CustomEvent('app:toast', { 
        detail: { type: 'error', title: 'Connection Error', description: 'Failed to reach the backend server.' } 
      }));
    } finally {
      setUploading(false);
      setDragActive(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files);
    }
  };

  const handleDeleteUpload = (index) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteAllSalesData = async () => {
    const ok = await confirm('Delete ALL sales data and related records (forecasts, recommendations, production plans)? This cannot be undone.', {
      title: 'Delete All Sales Data',
      confirmText: 'Delete All',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    try {
      await apiDelete('/api/sales?scope=all');
      setUploadedFiles([]);
      await fetchSalesData(null, false);
      window.dispatchEvent(new CustomEvent('app:forecasts-updated'));
      window.dispatchEvent(new CustomEvent('app:operations-data-updated'));
    } catch (err) {
      console.error('Delete all sales failed', err);
      alert(err?.message || 'Failed to delete sales data.');
    }
  };

  const handleClearUploadHistory = () => {
    confirm('Clear the list of uploaded documents? This does NOT delete sales data from the database.', {
      title: 'Clear Upload History',
      confirmText: 'Clear',
      variant: 'danger',
    }).then((ok) => {
      if (!ok) return;
      setUploadedFiles([]);
    });
  };

  const handleRunPredictions = async () => {
    const MAX_BULK_PRODUCTS = 12;
    try {
      setPredicting(true);
      setPredictProgress({ current: 0, total: 0 });

      const availableModels = demandModels.length ? demandModels : DEFAULT_DEMAND_MODELS;
      const finalModelId = selectedModelId || availableModels[0]?.id || 'baseline';
      const modelName = availableModels.find((m) => m.id === finalModelId)?.name || finalModelId;

      let uniqueProductIds = [];
      if (filterProduct !== 'all') {
        uniqueProductIds = [Number(filterProduct)];
      } else {
        const fallback = await apiGet('/api/sales/product-ids').catch(() => ({}));
        uniqueProductIds = (fallback.productIds || []).map(Number).filter(Boolean);
        if (uniqueProductIds.length === 0) {
          const salesList = sales || [];
          uniqueProductIds = Array.from(new Set(salesList.map((s) => s.product_id).filter(Boolean)));
        }
      }

      if (uniqueProductIds.length === 0) {
        alert('No products with sales history found. Upload sales data first (CSV needs product + quantity + date).');
        return;
      }

      if (uniqueProductIds.length > MAX_BULK_PRODUCTS && filterProduct === 'all') {
        const ok = await confirm(
          `Predict for the first ${MAX_BULK_PRODUCTS} of ${uniqueProductIds.length} products? (Faster than all at once.) Use the product filter to run one product only.`,
          { title: 'Limit prediction batch', confirmText: `Run ${MAX_BULK_PRODUCTS}`, cancelText: 'Cancel' }
        );
        if (!ok) return;
        uniqueProductIds = uniqueProductIds.slice(0, MAX_BULK_PRODUCTS);
      }

      const baseDaysAhead =
        dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : dateRange === '7d' ? 7 : 90;
      const now = new Date();
      const endOfYear = new Date(now.getFullYear(), 11, 31);
      const daysUntilYearEnd = Math.max(1, Math.ceil((endOfYear - now) / (24 * 60 * 60 * 1000)));
      const daysAhead = Math.min(baseDaysAhead, daysUntilYearEnd, 90);

      const total = uniqueProductIds.length;
      setPredictProgress({ current: 0, total });

      let generated = 0;
      let skipped = 0;
      let lastError = null;

      for (let i = 0; i < uniqueProductIds.length; i++) {
        const productId = uniqueProductIds[i];
        setPredictProgress({ current: i + 1, total });
        try {
          await apiPost('/api/forecast/generate', {
            product_id: productId,
            days_ahead: daysAhead,
            model_type: finalModelId,
            bulk_mode: true,
          });
          generated++;
        } catch (err) {
          const msg = err?.message || '';
          const isInsufficient =
            msg.includes('Insufficient historical data') ||
            msg.includes('data points') ||
            msg.includes('No historical sales') ||
            msg.includes('No historical sales data');
          if (isInsufficient) {
            skipped++;
          } else {
            lastError = err;
            console.warn('Forecast failed for product', productId, err);
            skipped++;
          }
        }
      }

      if (generated > 0) {
        try {
          await apiPost('/api/kpis/recalculate', { days: 90 }).catch(() => {});
        } catch (_) {}
        window.dispatchEvent(new CustomEvent('app:forecasts-updated'));
        await fetchSalesData(dateRange, true);
        setActiveTab('overview');
        const description = skipped > 0
          ? `Forecasts for ${generated} product(s) (${modelName}). ${skipped} skipped. See Overview → Sales Trends and Forecasted (30D).`
          : `Forecasts for ${generated} product(s) using ${modelName}. Open the Overview tab to see charts.`;
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { type: 'success', title: 'Predictions complete', description },
        }));
      } else {
        const description = lastError?.message
          ? `No forecasts saved. ${lastError.message}`
          : 'Each product needs at least one sales row in the database. Try Fast baseline model and upload again.';
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: { type: 'warning', title: 'No forecasts generated', description },
        }));
      }
    } catch (error) {
      console.error('Prediction error:', error);
      const msg = error?.message || 'Failed to generate forecasts. Please try again.';
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { type: 'error', title: 'AI Forecast Error', description: msg },
      }));
    } finally {
      setPredicting(false);
      setPredictProgress({ current: 0, total: 0 });
    }
  };

  const exportToCSV = () => {
    const csv = [
      ['Date', 'Product', 'Quantity', 'Unit Price', 'Total Amount', 'Customer', 'Region'],
      ...sales.map(sale => [
        new Date(sale.sale_date).toLocaleDateString(),
        sale.product_name || 'N/A',
        sale.quantity,
        sale.unit_price,
        sale.total_amount,
        sale.customer_name || 'N/A',
        sale.region || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-data-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const exportToExcel = () => {
    // For Excel export, you'd typically use a library like xlsx
    exportToCSV(); // Fallback to CSV for now
  };

  const totalRevenue = Number(stats?.totalRevenue || 0);
  const totalUnits = Number(stats?.totalQuantity || 0);
  const totalRecords = Number(stats?.totalRecords || 0);
  const dataQuality = totalRecords > 0 ? 98.7 : 0;

  // Predict only after a successful document upload (listed above with records > 0)
  const showPredictPanel = uploadedFiles.some((f) => Number(f.records) > 0);

  const productPerformanceData = (() => {
    if (!sales || !sales.length) return [];
    const byProduct = new Map();
    sales.forEach((s) => {
      const key = s.product_name || `Product ${s.product_id}`;
      const entry = byProduct.get(key) || { name: key, revenue: 0, units: 0 };
      entry.revenue += Number(s.total_amount) || 0;
      entry.units += Number(s.quantity) || 0;
      byProduct.set(key, entry);
    });
    return Array.from(byProduct.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  })();

  const regionalDistributionData = (() => {
    // Use actual sales regions only; no synthetic "Forecast" slice.
    if (!sales || !sales.length) return [];

    const byRegion = new Map();
    sales.forEach((s) => {
      const key = (s.region && String(s.region).trim()) || 'Unknown';
      const value = Number(s.total_amount) || 0;
      const existing = byRegion.get(key) || { name: key, value: 0 };
      existing.value += value;
      byRegion.set(key, existing);
    });

    return Array.from(byRegion.values()).filter((r) => r.value > 0);
  })();

  const baseRows = sales || [];

  const filteredSales = baseRows.filter((sale) => {
    const matchesSearch =
      sale.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  if (loading && !apiError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading sales data...</p>
        </div>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-neutral-950">
        <div className="text-center max-w-md mx-auto p-6 bg-white dark:bg-neutral-900 rounded-xl shadow border border-amber-200 dark:border-amber-900">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Connection problem</h2>
          <p className="text-gray-600 mb-4">{apiError}</p>
          <Button onClick={() => { setApiError(null); fetchSalesData(); }} className="bg-emerald-600 hover:bg-emerald-700">
            <RefreshCcw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-emerald-600" />
            Sales Data (Predict 2 – Sales)
          </h1>
          <p className="text-gray-500 mt-1">Predict 2 for sales (up to last 2 years of history). {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={exportToExcel}>
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Section Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Sales Data Management</h2>
          <p className="text-gray-500 mt-1">Upload, manage, and analyze historical sales data.</p>
        </div>
        <div className="flex items-center gap-2">
              <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last 2 years</SelectItem>
                </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => fetchSalesData()} disabled={loading}>
            <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleDeleteAllSalesData} className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30" disabled={loading}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete all sales data
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-gray-500 mt-1">
              {totalRevenue > 0 ? (
                <span className="text-green-600 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> From sales in selected period</span>
              ) : (
                'No revenue in selected period'
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Units Sold</CardTitle>
            <Package className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUnits.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">
              {totalUnits > 0 ? 'From sales in selected period' : 'No units in selected period'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <FileText className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRecords.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">
              {totalRecords === 0 && uploadedFiles.length > 0
                ? 'Re-upload or set period to Last year and refresh'
                : 'Sales rows in selected period'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Forecasted (30D)</CardTitle>
            <TrendingUp className="h-5 w-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(forecastMetrics?.totalRevenue || 0)}</div>
            <p className="text-xs text-indigo-600 mt-1 font-medium italic">AI Projected revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="upload">Upload Data</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sales Trends</CardTitle>
                  <CardDescription>Revenue and units sold over time</CardDescription>
                </div>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-[140px]">
                    <Calendar className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last 2 years</SelectItem>
                </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]" style={{ backgroundColor: darkBlueChartTheme.background, borderRadius: '8px', padding: '16px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesTrendData}>
                    <AreaGradient id="salesActual" />
                    <ForecastGradient id="salesForecast" />
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="month" {...axisProps} />
                    <YAxis {...axisProps} />
                    <Tooltip {...tooltipProps} />
                    <Legend verticalAlign="top" height={36}/>
                    <Area 
                      name="Actual Sales"
                      type="monotone" 
                      dataKey="revenue" 
                      stroke={darkBlueChartTheme.lineColor}
                      strokeWidth={2}
                      fill="url(#areaGradient-salesActual)"
                      fillOpacity={0.4}
                    />
                    <Area 
                      name="AI Projections"
                      type="monotone" 
                      dataKey="forecastRevenue" 
                      stroke="#8884d8"
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      fill="url(#areaGradient-salesForecast)"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upload Data Tab */}
        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload Sales Data</CardTitle>
              <CardDescription>Import historical sales data from Excel or CSV files.</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                  dragActive 
                    ? 'border-emerald-500 bg-emerald-50' 
                    : 'border-gray-300 hover:border-emerald-400 bg-gray-50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className={`w-12 h-12 mx-auto mb-4 ${dragActive ? 'text-emerald-600' : 'text-gray-400'}`} />
                <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Drop files here or click to browse
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Supports CSV and Excel files up to 10MB
                </p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Select Files'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
              </div>

              {uploadedFiles.length > 0 && (
                <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 dark:bg-neutral-900 px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      Uploaded documents ({uploadedFiles.length})
                    </p>
                    <Button
                      variant="outline"
                      size="xs"
                      className="h-7 px-2 text-xs"
                      onClick={handleClearUploadHistory}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Clear history
                    </Button>
                  </div>
                  <ul className="space-y-1.5 text-sm text-gray-600">
                    {uploadedFiles.slice(0, 20).map((f, i) => (
                      <li
                        key={`${f.uploadedAt}-${f.name}-${i}`}
                        className="flex items-center justify-between gap-2 py-1 border-b border-gray-100 last:border-0"
                      >
                        <span
                          className="font-medium text-gray-800 truncate"
                          title={f.name}
                        >
                          {f.name}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-gray-500">
                            {(f.size / 1024).toFixed(1)} KB
                            {f.records != null && f.records > 0 && ` · ${f.records} records`}
                            {' · '}
                            {new Date(f.uploadedAt).toLocaleDateString()}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-gray-500 hover:text-red-600"
                            onClick={() => handleDeleteUpload(i)}
                            title="Remove from history (does not delete sales data)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {uploadedFiles.length > 20 && (
                    <p className="text-xs text-gray-500 mt-2">and {uploadedFiles.length - 20} more</p>
                  )}
                </div>
              )}

              {!showPredictPanel && !loading && (
                <p className="mt-4 text-sm text-amber-700 dark:text-amber-300 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
                  Upload a CSV or Excel file above. After at least one row is imported, your file appears in <strong>Uploaded documents</strong> and <strong>Run Predict 2 (Sales)</strong> shows here.
                </p>
              )}

              {showPredictPanel && (
                <div ref={predictSectionRef} className="mt-6 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">Predict 2 – Sales</p>
                      <p className="text-sm text-emerald-700">
                        Sales data uploaded. Choose an AI model and run sales predictions.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                    <div className="w-full md:max-w-xs">
                      <div className="text-xs font-semibold text-emerald-800 uppercase">AI Model</div>
                      <Select
                        value={selectedModelId || (demandModels[0] || DEFAULT_DEMAND_MODELS[0])?.id || 'baseline'}
                        onValueChange={setSelectedModelId}
                      >
                        <SelectTrigger className="mt-1 border-emerald-200 dark:border-neutral-600 bg-white dark:bg-neutral-900">
                          <SelectValue placeholder="Choose model" />
                        </SelectTrigger>
                        <SelectContent>
                          {(demandModels.length ? demandModels : DEFAULT_DEMAND_MODELS).map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={handleRunPredictions}
                      disabled={predicting}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {predicting ? (
                        <>
                          <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                          {predictProgress.total > 0
                            ? `Predicting ${predictProgress.current}/${predictProgress.total}…`
                            : 'Starting…'}
                        </>
                      ) : (
                        <>
                          <BarChart3 className="w-4 h-4 mr-2" />
                          Run Predict 2 (Sales)
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Product Performance</CardTitle>
                <CardDescription>Top selling products</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]" style={{ backgroundColor: darkBlueChartTheme.background, borderRadius: '8px', padding: '16px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {productPerformanceData.length > 0 ? (
                      <AreaChart data={productPerformanceData}>
                        <AreaGradient id="productRevenue" />
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} />
                        <YAxis {...axisProps} />
                        <Tooltip formatter={(value) => formatCurrency(value)} {...tooltipProps} />
                        <Area 
                          type="monotone" 
                          dataKey="revenue" 
                          stroke={darkBlueChartTheme.lineColor}
                          strokeWidth={2}
                          fill="url(#areaGradient-productRevenue)"
                          fillOpacity={darkBlueChartTheme.areaFillOpacity}
                        />
                      </AreaChart>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-gray-500">
                        No sales data available for this period
                      </div>
                    )}
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Regional Distribution</CardTitle>
                <CardDescription>Sales by region</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {regionalDistributionData.length > 0 ? (
                      <PieChart>
                        <Pie
                          data={regionalDistributionData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {['#3b82f6', '#10b981', '#f59e0b', '#ef4444'].map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-gray-500 text-center px-4">
                        {uploadedFiles.length > 0
                          ? 'No regional values found for the current period. Make sure your uploaded file includes a Region column (any header containing the word "region") and that the date range above covers those sales dates.'
                          : 'No regional sales data available yet. Upload a sales file that includes a Region column to see distribution by region.'}
                      </div>
                    )}
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Records Tab */}
        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <CardTitle>Sales Records</CardTitle>
                  <CardDescription>View and manage all sales transactions</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search sales..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Select value={filterProduct} onValueChange={setFilterProduct}>
                    <SelectTrigger className="w-[160px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Filter by product" />
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
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-200 dark:border-neutral-600">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Product</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Quantity</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Unit Price</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Region</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredSales.length > 0 ? filteredSales.slice(0, 50).map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(sale.sale_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{sale.product_name || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {sale.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatCurrency(sale.unit_price || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatCurrency(sale.total_amount || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {sale.customer_name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant="outline">{sale.region || 'N/A'}</Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                          No sales records found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
