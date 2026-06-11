import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
  Search, Filter, AlertTriangle, CheckCircle, Clock, Package,
  Download, Plus, Edit, Eye, TrendingUp, TrendingDown,
  BarChart3, Warehouse, Box, RefreshCcw, ArrowUpDown, Upload, X, Loader2
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { apiGet, apiPut, apiPost } from '../../utils/api';
import { formatCurrency } from '../../utils/currency';

export default function StockOverview() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedItems, setSelectedItems] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState([]);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [products, setProducts] = useState([]);
  const [stockForm, setStockForm] = useState({ product_id: '', quantity: '', reason: '' });
  const [productForm, setProductForm] = useState({
    sku: '',
    name: '',
    description: '',
    category: '',
    warehouse: 'Zone A',
    unit_price: '',
    unit_cost: '',
    reorder_point: '',
    safety_stock: '',
    lead_time_days: '7',
    order_quantity: ''
  });
  const warehouses = ['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Main Warehouse'];
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user.role || '');
    fetchInventory();
    fetchProducts();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const data = await apiGet('/api/inventory');
      setInventory(data.inventory || []);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await apiGet('/api/products?limit=1000');
      setProducts(data.products || []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const handleAddStock = async () => {
    if (!stockForm.product_id || !stockForm.quantity) {
      alert('Please select a product and enter quantity');
      return;
    }

    try {
      const currentItem = inventory.find(i => i.product_id === parseInt(stockForm.product_id));
      const newStock = (currentItem?.current_stock || 0) + parseInt(stockForm.quantity);
      
      await apiPut(`/api/inventory/${stockForm.product_id}`, {
        current_stock: newStock,
        reason: stockForm.reason || 'Stock addition'
      });

      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: {
          type: 'success',
          title: 'Stock Updated',
          description: `Successfully added ${stockForm.quantity} units to inventory.`
        }
      }));

      await fetchInventory();
      setShowAddStockModal(false);
      setStockForm({ product_id: '', quantity: '', reason: '' });
    } catch (error) {
      console.error('Failed to add stock:', error);
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: {
          type: 'error',
          title: 'Failed',
          description: error?.message || 'Could not add stock. Please try again.'
        }
      }));
    }
  };

  const handleCreateProduct = async () => {
    if (!productForm.sku || !productForm.name || !productForm.unit_price || !productForm.unit_cost) {
      alert('Please fill in all required fields (SKU, Name, Unit Price, Unit Cost)');
      return;
    }

    try {
      const payload = {
        ...productForm,
        initial_quantity: 0,
        auto_create_po: true,
        order_quantity: Number(productForm.order_quantity || productForm.reorder_point || 100),
        description: productForm.warehouse
          ? `Warehouse: ${productForm.warehouse}${productForm.description ? ` — ${productForm.description}` : ''}`
          : productForm.description,
      };
      const res = await apiPost('/api/products', payload);
      await fetchProducts();
      await fetchInventory();
      setShowAddProductModal(false);
      window.dispatchEvent(new Event('app:operations-data-updated'));
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: {
          type: 'success',
          title: 'Product Added',
          description: res?.product?.auto_order_created
            ? `${productForm.name} created with zero stock — procurement order sent to Operations.`
            : `${productForm.name} created successfully.`,
        },
      }));
      setProductForm({
        sku: '',
        name: '',
        description: '',
        category: '',
        warehouse: 'Zone A',
        unit_price: '',
        unit_cost: '',
        reorder_point: '',
        safety_stock: '',
        lead_time_days: '7',
        order_quantity: ''
      });
    } catch (error) {
      console.error('Failed to create product:', error);
      alert(error.message || 'Failed to create product. Please try again.');
    }
  };

  const handleGenerateStockReport = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/inventory/report/csv', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('Failed to generate stock report');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory-stock-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download stock report:', error);
      alert('Failed to download stock report. Please try again.');
    }
  };

  const handleUploadProducts = async (files) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/products/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        const processed = data.recordsProcessed || 0;
        alert(`Products uploaded successfully. Processed ${processed} products.`);
        await fetchProducts();
        await fetchInventory();
        setShowUploadModal(false);
      } else {
        alert(data.error || 'Upload failed. Please check your file format and try again.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleEditStock = (item) => {
    setEditingItem(item);
    setStockForm({
      product_id: item.product_id.toString(),
      quantity: '',
      reason: ''
    });
    setShowAddStockModal(true);
  };


  const calculateStockLevel = (item) => {
    const reorderPoint = item.reorder_point || 100;
    const current = item.available_stock ?? item.current_stock ?? 0;
    if (reorderPoint === 0) return current > 0 ? 100 : 0;
    return Math.min(100, (current / reorderPoint) * 100);
  };

  const getStockStatus = (item) => {
    const available = item.available_stock ?? item.current_stock ?? 0;
    const safetyStock = item.safety_stock || 0;
    const reorderPoint = item.reorder_point || 100;
    
    if (available <= safetyStock) {
      return { label: 'Critical', color: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle };
    }
    if (available < reorderPoint) {
      return { label: 'Low', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock };
    }
    if (available >= reorderPoint * 2) {
      return { label: 'Overstock', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: Package };
    }
    return { label: 'Optimal', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle };
  };

  const filteredItems = inventory.filter(item => {
    const matchesSearch = 
      item.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus;
    const matchesCategory = selectedCategory === 'all' || (item.category || 'Uncategorized') === selectedCategory;
    const matchesLocation = selectedLocation === 'all';
    return matchesSearch && matchesStatus && matchesCategory && matchesLocation;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    const aVal = a[sortConfig.key] || '';
    const bVal = b[sortConfig.key] || '';
    if (sortConfig.direction === 'asc') {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  const metrics = {
    totalItems: inventory.length,
    totalValue: inventory.reduce((sum, item) => {
      const stock = item.available_stock ?? item.current_stock ?? 0;
      const cost = item.unit_cost || 0;
      return sum + (stock * cost);
    }, 0),
    lowStock: inventory.filter(item => {
      const available = item.available_stock ?? item.current_stock ?? 0;
      const reorderPoint = item.reorder_point || 100;
      return available < reorderPoint;
    }).length,
    optimal: inventory.filter(item => {
      const available = item.available_stock ?? item.current_stock ?? 0;
      const reorderPoint = item.reorder_point || 100;
      return available >= reorderPoint && available < reorderPoint * 2;
    }).length
  };

  const categoryData = inventory.reduce((acc, item) => {
    const category = item.category || 'Uncategorized';
    if (!acc[category]) acc[category] = { name: category, value: 0, items: 0 };
    const stock = item.available_stock ?? item.current_stock ?? 0;
    const cost = item.unit_cost || 0;
    acc[category].value += (stock * cost);
    acc[category].items += 1;
    return acc;
  }, {});

  const abcInventory = (() => {
    const sorted = [...inventory]
      .map((item) => {
        const stock = item.available_stock ?? item.current_stock ?? 0;
        const stockValue = stock * (item.unit_cost || 0);
        return { ...item, stock_value: stockValue };
      })
      .sort((a, b) => b.stock_value - a.stock_value);

    const totalValue = sorted.reduce((sum, item) => sum + item.stock_value, 0);
    let cumulative = 0;
    const details = sorted.map((item) => {
      cumulative += item.stock_value;
      const share = totalValue ? cumulative / totalValue : 0;
      const abc_category = share <= 0.7 ? 'A' : share <= 0.9 ? 'B' : 'C';
      return {
        ...item,
        abc_category,
        value_share: totalValue ? (item.stock_value / totalValue) * 100 : 0
      };
    });

    return {
      summary: {
        a_count: details.filter((item) => item.abc_category === 'A').length,
        b_count: details.filter((item) => item.abc_category === 'B').length,
        c_count: details.filter((item) => item.abc_category === 'C').length,
        total_value: totalValue
      },
      details: details.slice(0, 20)
    };
  })();

  // Get real stock movement from audit logs
  const [movementData, setMovementData] = useState([
    { month: 'Jan', in: 0, out: 0 },
    { month: 'Feb', in: 0, out: 0 },
    { month: 'Mar', in: 0, out: 0 },
    { month: 'Apr', in: 0, out: 0 },
    { month: 'May', in: 0, out: 0 },
    { month: 'Jun', in: 0, out: 0 },
    { month: 'Jul', in: 0, out: 0 }
  ]);

  useEffect(() => {
    fetchStockMovement();
  }, []);

  const fetchStockMovement = async () => {
    try {
      const data = await apiGet('/api/inventory/history?limit=100');
      const logs = data.logs || [];
      
      // Group by month and calculate ins/outs
      const monthly = {};
      logs.forEach(log => {
        try {
          const date = new Date(log.created_at);
          const month = date.toLocaleDateString('en-US', { month: 'short' });
          if (!monthly[month]) monthly[month] = { month, in: 0, out: 0 };
          
          if (log.action === 'STOCK_ADJUSTMENT' || log.action === 'UPDATE_INVENTORY') {
            const details = typeof log.details === 'string' ? JSON.parse(log.details) : (log.details || {});
            const change = (details.current_stock || 0) - (details.previous_stock || 0);
            if (change > 0) monthly[month].in += change;
            if (change < 0) monthly[month].out += Math.abs(change);
          }
        } catch (err) {
          console.error('Error processing log:', err);
        }
      });
      
      const sorted = Object.values(monthly).sort((a, b) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months.indexOf(a.month) - months.indexOf(b.month);
      });
      
      setMovementData(sorted.slice(-7).length > 0 ? sorted.slice(-7) : [
        { month: 'Jan', in: 0, out: 0 },
        { month: 'Feb', in: 0, out: 0 },
        { month: 'Mar', in: 0, out: 0 },
        { month: 'Apr', in: 0, out: 0 },
        { month: 'May', in: 0, out: 0 },
        { month: 'Jun', in: 0, out: 0 },
        { month: 'Jul', in: 0, out: 0 }
      ]);
    } catch (error) {
      console.error('Failed to fetch stock movement:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading stock overview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Box className="w-7 h-7 text-purple-600" />
            Stock Overview
          </h1>
          <p className="text-gray-500 mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={fetchInventory}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {(userRole === 'operations' || userRole === 'admin' || userRole === 'inventory' || userRole === 'inventory_manager') && (
            <>
              {(userRole === 'operations' || userRole === 'admin') && (
                <Button variant="outline" onClick={() => setShowUploadModal(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Products
                </Button>
              )}
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setShowAddProductModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </>
          )}
          <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleGenerateStockReport}>
            <Download className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalItems.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">{inventory.length} unique SKUs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalValue)}</div>
            <p className="text-xs text-gray-500 mt-1">Current inventory value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{metrics.lowStock}</div>
            <p className="text-xs text-gray-500 mt-1">Items need reorder</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Optimal Stock</CardTitle>
            <CheckCircle className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.optimal}</div>
            <p className="text-xs text-gray-500 mt-1">{inventory.length > 0 ? Math.round((metrics.optimal / inventory.length) * 100) : 0}% of inventory</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">ABC Inventory Classification</h2>
            <p className="text-sm text-gray-500">Rank SKUs by inventory value and highlight the top A-class items.</p>
          </div>
          <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="text-xs text-slate-500 uppercase font-semibold">Class A</div>
              <div className="text-2xl font-bold text-slate-900">{abcInventory.summary.a_count}</div>
              <div className="text-xs text-slate-500">Top 70% value</div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="text-xs text-slate-500 uppercase font-semibold">Class B</div>
              <div className="text-2xl font-bold text-slate-900">{abcInventory.summary.b_count}</div>
              <div className="text-xs text-slate-500">Next 20% value</div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="text-xs text-slate-500 uppercase font-semibold">Class C</div>
              <div className="text-2xl font-bold text-slate-900">{abcInventory.summary.c_count}</div>
              <div className="text-xs text-slate-500">Bottom 10% value</div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">ABC Class</th>
                <th className="px-4 py-3">Stock Value</th>
                <th className="px-4 py-3">Value Share</th>
              </tr>
            </thead>
            <tbody>
              {abcInventory.details.slice(0, 8).map((item) => (
                <tr key={item.product_id || item.sku} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.sku}</td>
                  <td className="px-4 py-3">{item.product_name || item.name}</td>
                  <td className="px-4 py-3">{item.abc_category}</td>
                  <td className="px-4 py-3">{formatCurrency(item.stock_value)}</td>
                  <td className="px-4 py-3">{item.value_share.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details">Inventory Details</TabsTrigger>
          <TabsTrigger value="category">By Category</TabsTrigger>
          <TabsTrigger value="movement">Stock Movement</TabsTrigger>
        </TabsList>

        {/* Inventory Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <CardTitle>Inventory Items</CardTitle>
                  <CardDescription>Showing {filteredItems.length} of {inventory.length} items</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search by name or SKU..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[160px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {Object.keys(categoryData).map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="shortage">Shortage</SelectItem>
                      <SelectItem value="overstock">Overstock</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                    <SelectTrigger className="w-[160px]">
                      <Warehouse className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      <SelectItem value="warehouse-a">Warehouse A</SelectItem>
                      <SelectItem value="warehouse-b">Warehouse B</SelectItem>
                      <SelectItem value="warehouse-c">Warehouse C</SelectItem>
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
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        <input type="checkbox" className="rounded" />
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('product_name')}
                      >
                        <div className="flex items-center gap-1">
                          Product
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">SKU</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('current_stock')}>
                        <div className="flex items-center gap-1">
                          Physical Stock
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('available_stock')}
                      >
                        <div className="flex items-center gap-1">
                          Available
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Stock Level</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Trend</th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('value')}
                      >
                        <div className="flex items-center gap-1">
                          Value
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Location</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sortedItems.length > 0 ? sortedItems.map((item) => {
                      const stockLevel = calculateStockLevel(item);
                      const status = getStockStatus(item);
                      const StatusIcon = status.icon;
                      const available = item.available_stock ?? item.current_stock ?? 0;
                      
                      return (
                        <tr key={item.product_id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <input 
                              type="checkbox" 
                              className="rounded"
                              checked={selectedItems.includes(item.product_id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedItems([...selectedItems, item.product_id]);
                                } else {
                                  setSelectedItems(selectedItems.filter(id => id !== item.product_id));
                                }
                              }}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium text-gray-900">{item.product_name || 'Product'}</div>
                              <div className="text-xs text-gray-500">{item.category || 'Uncategorized'}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-mono text-gray-600">{item.sku || 'N/A'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium text-gray-900">{item.current_stock ?? 0}</div>
                              <div className="text-xs text-gray-500">Physical</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium text-gray-900">{item.available_stock ?? item.current_stock ?? 0}</div>
                              <div className="text-xs text-gray-500">
                                Safety: {item.safety_stock || 0}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="w-full max-w-[120px]">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${
                                    stockLevel < 20 ? 'bg-red-500' :
                                    stockLevel < 50 ? 'bg-amber-500' :
                                    stockLevel < 80 ? 'bg-blue-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${stockLevel}%` }}
                                ></div>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">{stockLevel.toFixed(0)}%</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${status.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {status.label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-500">—</span>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium text-gray-900">
                                {formatCurrency((item.available_stock ?? item.current_stock ?? 0) * (item.unit_cost || 0))}
                              </div>
                              <div className="text-xs text-gray-500">{formatCurrency(item.unit_cost || 0)}/unit</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-600">Main Warehouse</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleEditStock(item)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="10" className="px-6 py-8 text-center text-gray-500">
                          No inventory items found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Category Tab */}
        <TabsContent value="category" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Inventory by Category</CardTitle>
              <CardDescription>Distribution of inventory value across categories (from your uploaded data)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] min-h-[300px]">
                {Object.keys(categoryData).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.values(categoryData)} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fill: '#374151', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#374151', fontSize: 12 }} tickFormatter={(v) => formatCurrency(v)} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="value" fill="#8b5cf6" name="Value" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <BarChart3 className="w-12 h-12 mb-2 opacity-50" />
                    <p className="font-medium">No category data yet</p>
                    <p className="text-sm">Upload products with a Category column or add categories to products.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stock Movement Tab */}
        <TabsContent value="movement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stock Movement</CardTitle>
              <CardDescription>Inventory in and out trends over time (from stock history)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={movementData.length > 0 ? movementData : [{ month: '—', in: 0, out: 0 }]} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fill: '#374151', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#374151', fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="in" stroke="#10b981" strokeWidth={2} name="Stock In" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="out" stroke="#ef4444" strokeWidth={2} name="Stock Out" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Stock Modal */}
      {showAddStockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-md mx-4 border border-gray-200 dark:border-neutral-700">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingItem ? 'Update Stock' : 'Add Stock'}
              </h2>
              <button onClick={() => {
                setShowAddStockModal(false);
                setEditingItem(null);
                setStockForm({ product_id: '', quantity: '', reason: '' });
              }}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <Select value={stockForm.product_id} onValueChange={(val) => setStockForm({ ...stockForm, product_id: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(product => (
                      <SelectItem key={product.id} value={product.id.toString()}>
                        {product.name} ({product.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editingItem ? 'Quantity to Add' : 'Quantity'}
                </label>
                <Input
                  type="number"
                  min="1"
                  value={stockForm.quantity}
                  onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                  placeholder="Enter quantity"
                />
                {editingItem && (
                  <p className="text-xs text-gray-500 mt-1">
                    Current: {editingItem.available_stock ?? editingItem.current_stock ?? 0} units
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <Input
                  value={stockForm.reason}
                  onChange={(e) => setStockForm({ ...stockForm, reason: e.target.value })}
                  placeholder="e.g. Restock, Return, Adjustment"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowAddStockModal(false);
                  setEditingItem(null);
                  setStockForm({ product_id: '', quantity: '', reason: '' });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-800 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStock}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                {editingItem ? 'Update Stock' : 'Add Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-2xl mx-4 my-8 border border-gray-200 dark:border-neutral-700">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Add New Product</h2>
              <button onClick={() => {
                setShowAddProductModal(false);
                setProductForm({
                  sku: '',
                  name: '',
                  description: '',
                  category: '',
                  unit_price: '',
                  unit_cost: '',
                  reorder_point: '',
                  safety_stock: '',
                  lead_time_days: '7'
                });
              }}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
                  <Input
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    placeholder="e.g. PROD-001"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <Input
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="Product name"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <Input
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="Product description"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse *</label>
                  <select
                    value={productForm.warehouse}
                    onChange={(e) => setProductForm({ ...productForm, warehouse: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {warehouses.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order Quantity (auto PO)</label>
                  <Input
                    type="number"
                    value={productForm.order_quantity}
                    onChange={(e) => setProductForm({ ...productForm, order_quantity: e.target.value })}
                    placeholder="Units to order at zero stock"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">New products start at 0 stock. A procurement order is sent to Operations automatically.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <Input
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    placeholder="e.g. Electronics, Materials"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lead Time (days)</label>
                  <Input
                    type="number"
                    value={productForm.lead_time_days}
                    onChange={(e) => setProductForm({ ...productForm, lead_time_days: e.target.value })}
                    placeholder="7"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price *</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={productForm.unit_price}
                    onChange={(e) => setProductForm({ ...productForm, unit_price: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost *</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={productForm.unit_cost}
                    onChange={(e) => setProductForm({ ...productForm, unit_cost: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Point</label>
                  <Input
                    type="number"
                    value={productForm.reorder_point}
                    onChange={(e) => setProductForm({ ...productForm, reorder_point: e.target.value })}
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Safety Stock</label>
                  <Input
                    type="number"
                    value={productForm.safety_stock}
                    onChange={(e) => setProductForm({ ...productForm, safety_stock: e.target.value })}
                    placeholder="50"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowAddProductModal(false);
                  setProductForm({
                    sku: '',
                    name: '',
                    description: '',
                    category: '',
                    unit_price: '',
                    unit_cost: '',
                    reorder_point: '',
                    safety_stock: '',
                    lead_time_days: '7'
                  });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-800 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProduct}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Create Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Products Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-lg mx-4 border border-gray-200 dark:border-neutral-700">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Upload Products</h2>
              <button onClick={() => setShowUploadModal(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Drop CSV/Excel file here or click to browse
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Required columns: SKU, Name, Unit Price, Unit Cost
                  <br />
                  Optional: Description, Category, Reorder Point, Safety Stock, Lead Time Days
                </p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Select File
                    </>
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleUploadProducts(e.target.files);
                    }
                  }}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
