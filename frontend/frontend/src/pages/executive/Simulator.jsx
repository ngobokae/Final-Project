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

  const MARGIN_RATE = 0.25;

  const calculateProjection = () => {
    if (!salesData || salesData.length === 0) {
      return {
        rows: [
          { month: 'Current', revenue: 0, profit: 0 },
          { month: 'Projected', revenue: 0, profit: 0 }
        ],
        currentRevenue: 0,
        currentProfit: 0,
        projectedRevenue: 0,
        projectedProfit: 0,
        costSavings: 0,
        roiPercent: 0,
        profitChange: 0
      };
    }

    const currentRevenue = Number(salesData[0].revenue || 0);
    const currentProfit = currentRevenue * MARGIN_RATE;
    const projectedRevenue = currentRevenue * (1 + priceChange / 100);
    const baseProjectedProfit = projectedRevenue * MARGIN_RATE;
    const costSavings = currentRevenue * (costReduction / 100);
    const projectedProfit = baseProjectedProfit + costSavings;
    const profitChange = currentProfit > 0 ? ((projectedProfit - currentProfit) / currentProfit) * 100 : 0;
    const roiPercent = currentProfit > 0 ? ((projectedProfit - currentProfit) / currentProfit) * 100 : 0;

    return {
      rows: [
        { month: 'Current', revenue: currentRevenue, profit: currentProfit },
        { month: 'Projected', revenue: projectedRevenue, profit: projectedProfit }
      ],
      currentRevenue,
      currentProfit,
      projectedRevenue,
      projectedProfit,
      costSavings,
      roiPercent,
      profitChange
    };
  };

  const projection = calculateProjection();
  const profitChange = projection.profitChange;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="w-7 h-7 text-purple-600" />
            Kinglion ROI Simulator
          </h1>
          <p className="text-gray-500 mt-1">Clear ROI from price changes and operational cost efficiency</p>
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

            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 space-y-2">
              <h4 className="text-xs uppercase font-bold text-purple-600">ROI Calculation</h4>
              <p className="text-xs text-purple-900">
                Current profit = Revenue × {Math.round(MARGIN_RATE * 100)}% margin
              </p>
              <p className="text-xs text-purple-900">
                Projected profit = (Adjusted revenue × {Math.round(MARGIN_RATE * 100)}%) + Cost savings
              </p>
              <p className="text-xs text-purple-900">
                ROI = (Projected profit − Current profit) ÷ Current profit × 100
              </p>
              <p className="text-sm text-purple-900 font-semibold pt-1">
                ROI: {projection.roiPercent.toFixed(1)}% ({profitChange >= 0 ? '+' : ''}{formatCurrency(projection.projectedProfit - projection.currentProfit)} / month)
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
                <LineChart data={projection.rows}>
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
                 <div className="text-xl font-bold text-gray-900">{formatCurrency(projection.projectedRevenue)}</div>
                 <div className={`text-xs flex items-center gap-1 mt-1 ${priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                   {priceChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                   {Math.abs(priceChange)}% vs current
                 </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                 <div className="text-xs text-gray-500 mb-1">Projected Profit</div>
                 <div className="text-xl font-bold text-gray-900">{formatCurrency(projection.projectedProfit)}</div>
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
