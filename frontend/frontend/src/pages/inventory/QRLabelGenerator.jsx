import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { QrCode, Printer, Download, Package, CheckSquare, Square } from 'lucide-react';
import { apiGet } from '../../utils/api';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export default function QRLabelGenerator() {
  const [inventory, setInventory] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

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

  const generatePDF = async () => {
    const doc = new jsPDF();
    const itemsToPrint = inventory.filter(i => selectedItems.includes(i.product_id));
    
    if (itemsToPrint.length === 0) {
      alert('Please select at least one item');
      return;
    }

    setGenerating(true);
    try {
      let x = 20;
      let y = 20;
      const boxWidth = 100;
      const boxHeight = 60;

      for (const item of itemsToPrint) {
        // Generate QR code data URL with just SKU (simpler data = better scannability)
        const qrData = await QRCode.toDataURL(item.sku, {
          errorCorrectionLevel: 'M',
          type: 'image/png',
          quality: 0.92,
          margin: 1,
          width: 300,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        // Draw label box
        doc.setDrawColor(100, 100, 100);
        doc.rect(x, y, boxWidth, boxHeight);
        
        // Add Brand
        doc.setFontSize(9);
        doc.setTextColor(150, 0, 0);
        doc.text('KINGLION', x + 5, y + 7);
        
        // Add Product Info (left side)
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        const productName = item.product_name.substring(0, 18);
        doc.text(productName, x + 5, y + 16);
        
        doc.setFontSize(7);
        doc.text(`SKU: ${item.sku}`, x + 5, y + 22);
        doc.text(`CAT: ${item.category || 'N/A'}`, x + 5, y + 27);
        doc.text(`Stock: ${item.available_stock || 0}`, x + 5, y + 32);
        
        // Add QR Code image (right side, larger size)
        doc.addImage(qrData, 'PNG', x + 60, y + 5, 35, 35);
        
        // Add barcode label
        doc.setFontSize(6);
        doc.text('SCAN QR', x + 70, y + 42);

        // Move to next position
        x += boxWidth + 8;
        if (x > 110) {
          x = 20;
          y += boxHeight + 8;
        }
        
        if (y > 230) {
          doc.addPage();
          x = 20;
          y = 20;
        }
      }

      doc.save('Kinglion_Inventory_Labels.pdf');
      
      window.dispatchEvent(new CustomEvent('app:toast', { 
        detail: { 
          type: 'success', 
          title: 'PDF Generated', 
          description: `${itemsToPrint.length} labels with scannable QR codes ready for printing. Make sure to print at 100% scale.` 
        } 
      }));
    } catch (error) {
      console.error('PDF generation error:', error);
      window.dispatchEvent(new CustomEvent('app:toast', { 
        detail: { type: 'error', title: 'Generation Failed', description: 'Could not generate PDF with QR codes.' } 
      }));
    } finally {
      setGenerating(false);
    }
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
            disabled={selectedItems.length === 0 || generating}
            className="bg-red-600 hover:bg-red-700"
          >
            <Printer className="w-4 h-4 mr-2" />
            {generating ? 'Generating...' : `Generate PDF Labels (${selectedItems.length})`}
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
