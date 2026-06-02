import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Slider } from '../../components/ui/slider';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Calculator, RefreshCcw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { apiGet } from '../../utils/api';
import { formatCurrency } from '../../utils/currency';

export default function ExecutiveSimulator() {
  const [salesData, setSalesData] = useState([]);
  const [priceChange, setPriceChange] = useState(0);
  const [costReduction, setCostReduction] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async () => {
    try {
      setLoading(true);
      const data = await apiGet('/api/sales/stats?days=30');
      // Simulated monthly trend
      const trend = [
        { month: 'Current', revenue: Number(data.total_revenue) || 5000000, profit: (Number(data.total_revenue) || 5000000) * 0.25 },
        { month: 'Projected', revenue: 0, profit: 0 }
      ];
      setSalesData(trend);
    } catch (error) {
      console.error('Failed to fetch sales stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateProjection = () => {
    if (!salesData || salesData.length === 0) {
      return [
        { month: 'Current', revenue: 0, profit: 0 },
        { month: 'Projected', revenue: 0, profit: 0 }
      ];
    }
    const current = salesData[0];
    const newRevenue = current.revenue * (1 + priceChange / 100);
    const newProfit = (newRevenue * 0.25) + (current.revenue * (costReduction / 100));
    
    return [
      current,
      { month: 'Projected', revenue: newRevenue, profit: newProfit }
    ];
  };

  const projection = calculateProjection();
  const profitChange = projection[0].profit > 0 ? ((projection[1].profit - projection[0].profit) / projection[0].profit) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="w-7 h-7 text-purple-600" />
            Kinglion Profit Simulator
          </h1>
          <p className="text-gray-500 mt-1">Simulate market changes to predict future revenue and profit</p>
        </div>
        <Button variant="outline" onClick={fetchSalesData}>
          <RefreshCcw className="w-4 h-4 mr-2" />
          Reset Base
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Simulation Controls</CardTitle>
            <CardDescription>Adjust variables to see impact</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Price Adjustment</label>
                <span className={`text-sm font-bold ${priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {priceChange > 0 ? '+' : ''}{priceChange}%
                </span>
              </div>
              <Slider 
                min={-20} 
                max={20} 
                step={1} 
                value={[priceChange]} 
                onValueChange={(val) => setPriceChange(val[0])}
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>-20% (Discount)</span>
                <span>Market Standard</span>
                <span>+20% (Premium)</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Operational Cost Efficiency</label>
                <span className="text-sm font-bold text-blue-600">
                  {costReduction}% Save
                </span>
              </div>
              <Slider 
                min={0} 
                max={15} 
                step={0.5} 
                value={[costReduction]} 
                onValueChange={(val) => setCostReduction(val[0])}
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Current Cost</span>
                <span>High Efficiency</span>
              </div>
            </div>

            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
              <h4 className="text-xs uppercase font-bold text-purple-600 mb-2">Executive Summary</h4>
              <p className="text-sm text-purple-900 leading-relaxed">
                A {priceChange}% price change combined with {costReduction}% cost efficiency will result in a 
                <span className="font-bold"> {profitChange.toFixed(1)}% {profitChange >= 0 ? 'increase' : 'decrease'} </span>
                in monthly net profit.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Results Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Impact Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projection}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(val) => `FRW ${val/1000000}M`} />
                  <Tooltip formatter={(val) => formatCurrency(val)} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} name="Total Revenue" />
                  <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} name="Net Profit" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8">
              <div className="p-4 bg-gray-50 rounded-xl">
                 <div className="text-xs text-gray-500 mb-1">Projected Revenue</div>
                 <div className="text-xl font-bold text-gray-900">{formatCurrency(projection[1].revenue)}</div>
                 <div className={`text-xs flex items-center gap-1 mt-1 ${priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                   {priceChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                   {Math.abs(priceChange)}% vs current
                 </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                 <div className="text-xs text-gray-500 mb-1">Projected Profit</div>
                 <div className="text-xl font-bold text-gray-900">{formatCurrency(projection[1].profit)}</div>
                 <div className={`text-xs flex items-center gap-1 mt-1 ${profitChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                   {profitChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                   {Math.abs(profitChange).toFixed(1)}% vs current
                 </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
