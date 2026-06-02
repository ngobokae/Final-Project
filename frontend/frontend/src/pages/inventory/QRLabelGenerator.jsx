import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { QrCode, Printer, Download, Package, CheckSquare, Square } from 'lucide-react';
import { apiGet } from '../../utils/api';
import { jsPDF } from 'jspdf';

export default function QRLabelGenerator() {
  const [inventory, setInventory] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
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

  const toggleItem = (id) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(i => i !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const toggleAll = () => {
    if (selectedItems.length === inventory.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(inventory.map(i => i.product_id));
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const itemsToPrint = inventory.filter(i => selectedItems.includes(i.product_id));
    
    if (itemsToPrint.length === 0) {
      alert('Please select at least one item');
      return;
    }

    let x = 20;
    let y = 20;
    const boxWidth = 80;
    const boxHeight = 50;

    itemsToPrint.forEach((item, index) => {
      // Draw label box
      doc.setDrawColor(200, 200, 200);
      doc.rect(x, y, boxWidth, boxHeight);
      
      // Add Brand
      doc.setFontSize(10);
      doc.setTextColor(150, 0, 0);
      doc.text('KINGLION RWANDA', x + 5, y + 8);
      
      // Add Product Info
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(item.product_name.substring(0, 25), x + 5, y + 18);
      doc.setFontSize(10);
      doc.text(`SKU: ${item.sku}`, x + 5, y + 25);
      doc.text(`CAT: ${item.category || 'N/A'}`, x + 5, y + 32);
      
      // Draw a simulated QR code box
      doc.setFillColor(0, 0, 0);
      doc.rect(x + 55, y + 10, 20, 20);
      doc.setFontSize(6);
      doc.setTextColor(255, 255, 255);
      doc.text('SCAN', x + 59, y + 21);

      // Move to next position
      x += boxWidth + 10;
      if (x > 120) {
        x = 20;
        y += boxHeight + 10;
      }
      
      if (y > 240 && index < itemsToPrint.length - 1) {
        doc.addPage();
        x = 20;
        y = 20;
      }
    });

    doc.save('Kinglion_Inventory_Labels.pdf');
    
    window.dispatchEvent(new CustomEvent('app:toast', { 
      detail: { type: 'success', title: 'PDF Generated', description: `${itemsToPrint.length} labels are ready for printing.` } 
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <QrCode className="w-7 h-7 text-red-600" />
            Stock Label Generator
          </h1>
          <p className="text-gray-500 mt-1">Generate printable labels with QR codes for shelf organization</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={generatePDF} 
            disabled={selectedItems.length === 0}
            className="bg-red-600 hover:bg-red-700"
          >
            <Printer className="w-4 h-4 mr-2" />
            Generate PDF Labels ({selectedItems.length})
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b bg-gray-50/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Select Products</CardTitle>
              <CardDescription>Choose the items you want to create labels for</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={toggleAll} className="text-blue-600">
              {selectedItems.length === inventory.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Select</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {inventory.map((item) => (
                  <tr 
                    key={item.product_id} 
                    className={`hover:bg-gray-50 cursor-pointer ${selectedItems.includes(item.product_id) ? 'bg-blue-50/30' : ''}`}
                    onClick={() => toggleItem(item.product_id)}
                  >
                    <td className="px-6 py-4">
                      {selectedItems.includes(item.product_id) ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-300" />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{item.product_name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-500">{item.sku}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.category}</td>
                    <td className="px-6 py-4">
                      <div className="w-10 h-10 bg-neutral-900 rounded-sm flex items-center justify-center">
                        <QrCode className="w-6 h-6 text-white" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
