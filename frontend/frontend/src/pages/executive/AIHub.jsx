import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { 
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { Brain, TrendingUp, AlertTriangle, Zap, Download, RefreshCw } from 'lucide-react';
import { apiGet } from '../../utils/api';

export default function AIHub() {
  const [loading, setLoading] = useState(true);
  const [forecastData, setForecastData] = useState([]);
  const [scenario, setScenario] = useState({
    demandIncrease: 10,
    supplyChainDelay: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/dashboard/forecast-chart');
      setForecastData(res.chartData || []);
    } catch (error) {
      console.error('Error fetching AI data:', error);
    } finally {
      setLoading(false);
    }
  };

  const simulatedData = forecastData.map(item => {
    const isFuture = new Date(item.date) >= new Date().setHours(0,0,0,0);
    return {
      ...item,
      name: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sales: item.actual_sales > 0 ? item.actual_sales : (isFuture ? null : 0),
      forecast: item.forecasted_demand > 0 ? item.forecasted_demand : (isFuture ? 0 : null),
      simulated: item.forecasted_demand > 0 
        ? Math.round(item.forecasted_demand * (1 + scenario.demandIncrease / 100)) 
        : (isFuture ? 0 : null)
    };
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="w-8 h-8 text-red-600" />
            AI Intelligence Hub
          </h1>
          <p className="text-gray-500">Predictive insights and what-if scenario modeling</p>
        </div>
        <Button onClick={fetchData} variant="outline" className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Sync AI Models
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scenario Modeler */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Scenario Modeler
            </CardTitle>
            <CardDescription>Adjust variables to simulate future outcomes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Anticipated Demand Increase (%)</Label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={scenario.demandIncrease}
                  onChange={(e) => setScenario({...scenario, demandIncrease: parseInt(e.target.value)})}
                  className="flex-1 accent-red-600"
                />
                <span className="font-bold text-red-600 w-12 text-right">{scenario.demandIncrease}%</span>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="p-4 bg-gray-50 rounded-lg border space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Recommendation</p>
                <p className="text-sm">
                  Based on a <span className="font-bold text-red-600">{scenario.demandIncrease}%</span> demand surge, 
                  you should increase production of <span className="font-bold">Kinglion Iron Sheets</span> by 
                  <span className="font-bold"> {Math.round(scenario.demandIncrease * 0.8)}%</span>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visual Forecast */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Predictive Demand Forecast</CardTitle>
            <CardDescription>Actual Sales vs AI Forecast vs Simulated Scenario</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={simulatedData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend verticalAlign="top" height={36}/>
                  <Area 
                    name="Actual Sales"
                    type="monotone" 
                    dataKey="sales" 
                    stroke="#4f46e5" 
                    fill="#4f46e5"
                    fillOpacity={0.4} 
                  />
                  <Line 
                    name="AI Forecast"
                    type="monotone" 
                    dataKey="forecast" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                  <Line 
                    name="Simulated Scenario"
                    type="monotone" 
                    dataKey="simulated" 
                    stroke="#ef4444" 
                    strokeWidth={3}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-4">
          <div className="p-2 bg-blue-500 rounded-lg">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-blue-600 font-semibold italic">Growth Opportunity</p>
            <p className="text-sm text-blue-900 mt-1">AI detected a 15% trend uptick in Regional Sales.</p>
          </div>
        </div>

        <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 flex items-start gap-4">
          <div className="p-2 bg-orange-500 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-orange-600 font-semibold italic">Risk Detected</p>
            <p className="text-sm text-orange-900 mt-1">Vendor delay predicted for Component X (80% confidence).</p>
          </div>
        </div>

        <div className="p-4 bg-green-50 rounded-xl border border-green-100 flex items-start gap-4">
          <div className="p-2 bg-green-500 rounded-lg">
            <Download className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-green-600 font-semibold italic">Optimization</p>
            <p className="text-sm text-green-900 mt-1">Storage costs can be reduced by 5% with current plan.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
