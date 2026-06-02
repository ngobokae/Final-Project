import { useState, useEffect } from 'react';
import { apiGet } from '../../utils/api';
import { formatCurrency } from '../../utils/currency';
import { Zap, TrendingUp, Package, AlertTriangle, CheckCircle, RefreshCw, Target, BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Optimization() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [performanceData, setPerformanceData] = useState([
    { month: 'Jul', turnover: 0, accuracy: 0, service: 0 },
    { month: 'Aug', turnover: 0, accuracy: 0, service: 0 },
    { month: 'Sep', turnover: 0, accuracy: 0, service: 0 },
    { month: 'Oct', turnover: 0, accuracy: 0, service: 0 },
    { month: 'Nov', turnover: 0, accuracy: 0, service: 0 },
    { month: 'Dec', turnover: 0, accuracy: 0, service: 0 },
    { month: 'Jan', turnover: 0, accuracy: 0, service: 0 }
  ]);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/forecast/recommendations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const recs = data.recommendations || [];
        
        // If no recommendations exist, generate them for all products
        if (recs.length === 0) {
          await generateRecommendationsForAll();
          // Fetch again after generation
          const retryResponse = await fetch('http://localhost:3001/api/forecast/recommendations', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            setRecommendations(retryData.recommendations || []);
          } else {
            setRecommendations([]);
          }
        } else {
          setRecommendations(recs);
        }
      } else {
        setRecommendations([]);
      }
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendationsForAll = async () => {
    try {
      // Get all products
      const token = localStorage.getItem('token');
      const productsResponse = await fetch('http://localhost:3001/api/products?limit=1000', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        const products = productsData.products || [];
        
        // Generate recommendations for each product
        for (const product of products) {
          try {
            await fetch('http://localhost:3001/api/forecast/recommendations', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ product_id: product.id })
            });
          } catch (err) {
            console.error(`Failed to generate recommendation for product ${product.id}:`, err);
          }
        }
      }
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
    }
  };


  const runOptimization = async () => {
    setOptimizing(true);
    try {
      const token = localStorage.getItem('token');
      
      // Get all products
      const productsResponse = await fetch('http://localhost:3001/api/products?limit=1000', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        const products = productsData.products || [];
        
        // Generate recommendations for each product
        for (const product of products) {
          try {
            await fetch('http://localhost:3001/api/forecast/recommendations', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ product_id: product.id })
            });
          } catch (err) {
            console.error(`Failed to optimize product ${product.id}:`, err);
          }
        }
      }
      
      // Refresh recommendations
      await fetchRecommendations();
    } catch (error) {
      console.error('Optimization failed:', error);
      alert('Optimization failed. Please try again.');
    } finally {
      setOptimizing(false);
    }
  };

  const getRiskBadge = (riskLevel, riskType) => {
    const styles = {
      high: 'bg-red-100 text-red-800 border-red-200',
      medium: 'bg-amber-100 text-amber-800 border-amber-200',
      low: 'bg-green-100 text-green-800 border-green-200'
    };
    return styles[riskLevel] || styles.low;
  };

  const stats = {
    total: recommendations.length,
    highRisk: recommendations.filter(r => r.risk_level === 'high').length,
    mediumRisk: recommendations.filter(r => r.risk_level === 'medium').length,
    optimal: recommendations.filter(r => r.risk_type === 'none').length
  };

  // Calculate real optimization metrics from recommendations
  const calculateOptimizationMetrics = () => {
    if (recommendations.length === 0) {
      return {
        costReduction: 0,
        stockoutPrevention: 0,
        efficiency: 0,
        turnover: 0,
        overall: 0,
        totalSavings: 0
      };
    }

    const totalProducts = recommendations.length;
    const highRiskCount = recommendations.filter(r => r.risk_level === 'high').length;
    const mediumRiskCount = recommendations.filter(r => r.risk_level === 'medium').length;
    const optimalCount = recommendations.filter(r => r.risk_type === 'none').length;
    
    // Calculate potential savings from recommendations
    const totalSavings = recommendations.reduce((sum, rec) => {
      const currentStock = rec.current_stock ?? rec.available_stock ?? 0;
      const recommendedStock = rec.recommended_stock ?? 0;
      const diff = Math.abs(recommendedStock - currentStock);
      // Estimate cost savings (simplified calculation)
      return sum + (diff * 10); // Assume FRW 10 per unit savings
    }, 0);

    return {
      costReduction: totalProducts > 0 ? Math.min(100, Math.round((optimalCount / totalProducts) * 100)) : 0,
      stockoutPrevention: totalProducts > 0 ? Math.min(100, Math.round(((totalProducts - highRiskCount) / totalProducts) * 100)) : 0,
      efficiency: totalProducts > 0 ? Math.min(100, Math.round(((totalProducts - mediumRiskCount - highRiskCount) / totalProducts) * 100)) : 0,
      turnover: totalProducts > 0 ? Math.min(100, Math.round((optimalCount / totalProducts) * 100 + 20)) : 0,
      overall: totalProducts > 0 ? Math.round((optimalCount / totalProducts) * 100) : 0,
      totalSavings
    };
  };

  const metrics = calculateOptimizationMetrics();
  
  // Optimization metrics bars
  const optimizationMetrics = [
    { name: 'Cost Reduction', value: metrics.costReduction, color: 'bg-green-500', target: 100 },
    { name: 'Stockout Prevention', value: metrics.stockoutPrevention, color: 'bg-red-500', target: 100 },
    { name: 'Efficiency', value: metrics.efficiency, color: 'bg-blue-500', target: 100 },
    { name: 'Turnover', value: metrics.turnover, color: 'bg-orange-500', target: 100 },
    { name: 'Optimization', value: metrics.overall, color: 'bg-purple-500', target: 100 }
  ];

  // Update performance data when recommendations change
  useEffect(() => {
    if (recommendations.length > 0) {
      const currentMetrics = calculateOptimizationMetrics();
      setPerformanceData(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          month: 'Jan',
          turnover: currentMetrics.turnover,
          accuracy: currentMetrics.stockoutPrevention,
          service: currentMetrics.efficiency
        };
        return updated;
      });
    }
  }, [recommendations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-7 h-7 text-purple-600" />
            Optimization
          </h1>
          <p className="text-gray-500 mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button
          onClick={runOptimization}
          disabled={optimizing}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/30 disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${optimizing ? 'animate-spin' : ''}`} />
          {optimizing ? 'Optimizing...' : 'Run Optimization'}
        </button>
      </div>

      {/* Optimization Metrics Bars */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-1">Optimization Score</div>
          <div className="text-3xl font-bold text-gray-900">{formatCurrency(metrics.totalSavings)}</div>
          <div className="text-xs text-gray-500 mt-1">Potential savings from recommendations</div>
        </div>
        <div className="space-y-3">
          {optimizationMetrics.map((metric, index) => (
            <div key={index}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{metric.name}</span>
                <span className="text-sm text-gray-500">{metric.value}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${metric.color}`}
                  style={{ width: `${metric.value}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Products</div>
              <div className="text-xl font-bold text-gray-900">{stats.total}</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">High Risk</div>
              <div className="text-xl font-bold text-red-600">{stats.highRisk}</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Medium Risk</div>
              <div className="text-xl font-bold text-amber-600">{stats.mediumRisk}</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Optimal</div>
              <div className="text-xl font-bold text-green-600">{stats.optimal}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="recommendations" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="performance">Performance Trends</TabsTrigger>
        </TabsList>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <div key={rec.id} className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      rec.risk_level === 'high' ? 'bg-red-100' :
                      rec.risk_level === 'medium' ? 'bg-amber-100' : 'bg-green-100'
                    }`}>
                      {rec.risk_level === 'high' ? (
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                      ) : rec.risk_level === 'medium' ? (
                        <Target className="w-6 h-6 text-amber-600" />
                      ) : (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{rec.product_name}</h3>
                        <span className="text-sm text-gray-500">{rec.sku}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getRiskBadge(rec.risk_level, rec.risk_type)}`}>
                          {rec.risk_level.charAt(0).toUpperCase() + rec.risk_level.slice(1)} Risk
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{rec.reasoning}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 lg:gap-8">
                    <div className="text-center">
                      <div className="text-xs text-gray-500 uppercase">Current</div>
                      <div className="text-lg font-bold text-gray-900">{rec.current_stock ?? rec.available_stock ?? 0}</div>
                    </div>
                    <div className="text-2xl text-gray-300">→</div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 uppercase">Recommended</div>
                      <div className="text-lg font-bold text-purple-600">{rec.recommended_stock ?? 0}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 uppercase">Order Qty</div>
                      <div className={`text-lg font-bold ${(rec.optimal_order_quantity ?? 0) > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                        {(rec.optimal_order_quantity ?? 0) > 0 ? `+${rec.optimal_order_quantity}` : '0'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Performance Trends Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Performance Metrics Trend</h2>
            <p className="text-sm text-gray-500 mb-6">Track optimization progress over time</p>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="turnover" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Turnover Rate"
                    dot={{ r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="accuracy" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="Stock Accuracy (%)"
                    dot={{ r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="service" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    name="Service Level (%)"
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
