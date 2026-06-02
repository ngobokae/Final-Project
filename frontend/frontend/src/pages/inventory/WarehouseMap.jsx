import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Package, Warehouse, Info, AlertTriangle, CheckCircle, Search } from 'lucide-react';
import { apiGet } from '../../utils/api';

export default function WarehouseMap() {
  const [inventory, setInventory] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory();
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

  // Divide inventory into zones (A, B, C, D) based on category
  const zones = {
    'Zone A': inventory.filter(i => (i.category || '').toLowerCase().includes('sheet') || (i.category || '').toLowerCase().includes('metal')),
    'Zone B': inventory.filter(i => (i.category || '').toLowerCase().includes('motor') || (i.category || '').toLowerCase().includes('vehicle')),
    'Zone C': inventory.filter(i => (i.category || '').toLowerCase().includes('spare') || (i.category || '').toLowerCase().includes('part')),
    'Zone D': inventory.filter(i => !['sheet', 'metal', 'motor', 'vehicle', 'spare', 'part'].some(k => (i.category || '').toLowerCase().includes(k)))
  };

  const getZoneStatus = (items) => {
    if (items.some(i => i.status === 'shortage')) return 'critical';
    if (items.some(i => i.status === 'reorder')) return 'low';
    return 'optimal';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Warehouse className="w-7 h-7 text-blue-600" />
            Interactive Warehouse Map
          </h1>
          <p className="text-gray-500 mt-1">Visual representation of Kinglion storage facilities</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visual Map */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Warehouse Floor Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video bg-neutral-100 dark:bg-neutral-800 rounded-2xl border-4 border-dashed border-neutral-300 dark:border-neutral-700 p-8 grid grid-cols-2 gap-8">
              {Object.entries(zones).map(([name, items]) => {
                const status = getZoneStatus(items);
                const isSelected = selectedZone === name;
                
                return (
                  <div
                    key={name}
                    onClick={() => setSelectedZone(name)}
                    className={`relative cursor-pointer group transition-all duration-300 rounded-xl border-2 flex flex-col items-center justify-center gap-2 ${
                      isSelected 
                        ? 'bg-blue-600/10 border-blue-600 scale-105 shadow-xl shadow-blue-600/20 z-10' 
                        : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:border-blue-400'
                    }`}
                  >
                    <div className={`p-3 rounded-full ${
                      status === 'critical' ? 'bg-red-100 text-red-600' :
                      status === 'low' ? 'bg-amber-100 text-amber-600' :
                      'bg-green-100 text-green-600'
                    }`}>
                      <Warehouse className="w-8 h-8" />
                    </div>
                    <span className="font-bold text-lg">{name}</span>
                    <span className="text-xs text-gray-500">{items.length} SKUs stored</span>
                    
                    {status === 'critical' && (
                      <div className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full animate-bounce">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    )}
                    
                    <div className="w-full px-4 mt-2">
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-1000 ${
                            status === 'critical' ? 'bg-red-500' :
                            status === 'low' ? 'bg-amber-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(100, (items.length / 5) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Warehouse Entrance Label */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-[10px] px-3 py-1 rounded-t-lg uppercase tracking-widest font-bold border border-b-0 border-white/20">
                Main Entrance / Loading Dock
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Zone Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-500" />
              {selectedZone ? `${selectedZone} Details` : 'Select a Zone'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedZone ? (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                   <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-1">Zone Overview</h4>
                   <p className="text-xs text-blue-700 dark:text-blue-300">
                     This zone is currently at {Math.min(100, (zones[selectedZone].length / 5) * 100)}% capacity.
                   </p>
                </div>
                
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {zones[selectedZone].map((item) => (
                    <div key={item.product_id} className="p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-sm">{item.product_name}</span>
                        <Badge variant={item.status === 'shortage' ? 'destructive' : item.status === 'reorder' ? 'secondary' : 'outline'}>
                          {item.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Stock: {item.available_stock ?? item.current_stock ?? 0}</span>
                        <span className="font-mono">{item.sku}</span>
                      </div>
                    </div>
                  ))}
                  {zones[selectedZone].length === 0 && (
                    <p className="text-center text-gray-500 py-8 text-sm">No items stored in this zone</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-20 text-center opacity-50">
                <Search className="w-12 h-12 mb-4 text-gray-300" />
                <p>Click a zone on the map to view stored items and capacity levels.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
