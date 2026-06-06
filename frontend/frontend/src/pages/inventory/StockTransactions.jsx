import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { apiGet, apiPost } from '../../utils/api';
import { ArrowDownCircle, ArrowUpCircle, PackagePlus, ShoppingCart, Truck, Brain, Package } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';

const TXN_OPTIONS = [
  { value: 'stock_in', label: 'Stock In', icon: PackagePlus },
  { value: 'stock_out', label: 'Stock Out', icon: ArrowDownCircle },
  { value: 'sold', label: 'Sold (Stock Out)', icon: ShoppingCart },
  { value: 'ordered', label: 'Ordered (Stock In)', icon: Truck },
  { value: 'adjustment_in', label: 'Adjustment In', icon: ArrowUpCircle },
  { value: 'adjustment_out', label: 'Adjustment Out', icon: ArrowDownCircle }
];

export default function StockTransactions() {
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [salesRows, setSalesRows] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rangePreset, setRangePreset] = useState('30');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [form, setForm] = useState({
    product_id: '',
    transaction_type: 'stock_in',
    quantity: '',
    unit_price: '',
    customer_name: '',
    region: '',
    notes: ''
  });
  const [prefillNotice, setPrefillNotice] = useState('');

  const transactionLabelMap = useMemo(
    () => Object.fromEntries(TXN_OPTIONS.map((o) => [o.value, o.label])),
    []
  );

  const getTxnAmount = (t) => {
    const explicit = t?.total_amount;
    if (explicit != null && Number.isFinite(Number(explicit))) return Number(explicit);
    const qty = Number(t?.quantity || 0);
    const price = Number(t?.unit_price || 0);
    if (qty > 0 && price > 0) return qty * price;
    return null;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const query = new URLSearchParams({ limit: '200' });
      if (rangePreset === 'custom') {
        if (!fromDate || !toDate) {
          setError('Please select both start and end dates for custom range.');
          setLoading(false);
          return;
        }
        if (fromDate > toDate) {
          setError('Start date cannot be after end date.');
          setLoading(false);
          return;
        }
        query.set('from_date', fromDate);
        query.set('to_date', toDate);
      } else {
        query.set('days', rangePreset);
      }
      const [productsRes, transactionsRes, recsRes] = await Promise.all([
        apiGet('/api/products?limit=1000'),
        apiGet(`/api/inventory/transactions?${query.toString()}`),
        apiGet('/api/forecast/recommendations').catch(() => ({ recommendations: [] }))
      ]);
      setProducts(productsRes?.products || []);
      setTransactions(transactionsRes?.transactions || []);
      const recList = Array.isArray(recsRes)
        ? recsRes
        : recsRes?.recommendations || recsRes?.data || [];
      setRecommendations(recList.slice(0, 20));
      const salesRes = await apiGet('/api/sales?limit=500');
      setSalesRows(salesRes?.sales || []);
    } catch (e) {
      console.error('Failed to load stock transaction data:', e);
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const productIdRaw = params.get('product_id') || params.get('productId') || '';
    const productName = (params.get('product_name') || '').trim().toLowerCase();
    const sku = (params.get('sku') || '').trim().toLowerCase();
    const transactionType = params.get('transaction_type') || '';
    const quantity = params.get('quantity') || '';
    const notes = params.get('notes') || '';
    if (!productIdRaw && !productName && !sku && !transactionType && !quantity && !notes) return;

    let resolvedProductId = productIdRaw;
    if (!resolvedProductId && products.length > 0) {
      const bySku = sku ? products.find((p) => String(p.sku || '').trim().toLowerCase() === sku) : null;
      const byName = productName
        ? products.find((p) => String(p.name || '').trim().toLowerCase() === productName)
        : null;
      const matched = bySku || byName;
      if (matched?.id != null) {
        resolvedProductId = String(matched.id);
      }
    }

    setForm((prev) => ({
      ...prev,
      product_id: resolvedProductId || prev.product_id,
      transaction_type: transactionType || prev.transaction_type,
      quantity: quantity || prev.quantity,
      notes: notes || prev.notes
    }));
    if (transactionType === 'ordered') {
      setPrefillNotice('Prefilled from alert. Please enter supplier/source and region, then record transaction.');
    }
  }, [location.search, products]);

  const transactionAmountSummary = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const t of transactions) {
      if (t?.transaction_type !== 'sold' && t?.transaction_type !== 'stock_out') continue;
      const amount = getTxnAmount(t);
      if (amount == null) continue;
      total += amount;
      count += 1;
    }
    return { total, count };
  }, [transactions]);

  const salesSummary = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let todayRevenue = 0;
    let monthUnits = 0;
    const regionRevenue = new Map();

    for (const row of salesRows) {
      const d = row?.sale_date ? new Date(row.sale_date) : null;
      if (!d || Number.isNaN(d.getTime())) continue;

      const amount = Number(row.total_amount || 0);
      const qty = Number(row.quantity || 0);

      if (d.toDateString() === today) {
        todayRevenue += amount;
      }
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        monthUnits += qty;
      }

      const region = row.region && String(row.region).trim() ? String(row.region).trim() : 'Unknown';
      regionRevenue.set(region, (regionRevenue.get(region) || 0) + amount);
    }

    let topRegion = 'N/A';
    let topRegionRevenue = 0;
    for (const [region, value] of regionRevenue.entries()) {
      if (value > topRegionRevenue) {
        topRegion = region;
        topRegionRevenue = value;
      }
    }

    return {
      todayRevenue,
      monthUnits,
      topRegion,
      topRegionRevenue
    };
  }, [salesRows]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.product_id || !form.transaction_type || !form.quantity) {
      setError('Please fill product, type, and quantity.');
      return;
    }

    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Quantity must be greater than 0.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const payload = {
        product_id: Number(form.product_id),
        transaction_type: form.transaction_type,
        quantity: qty,
        notes: form.notes
      };
      if ((form.transaction_type === 'sold' || form.transaction_type === 'stock_out' || form.transaction_type === 'ordered') && form.unit_price) {
        payload.unit_price = Number(form.unit_price);
      }
      if (form.transaction_type === 'sold' || form.transaction_type === 'stock_out' || form.transaction_type === 'ordered') {
        if (form.customer_name) payload.customer_name = form.customer_name;
        if (form.region) payload.region = form.region;
      }

      await apiPost('/api/inventory/transactions', {
        ...payload
      });
      window.dispatchEvent(new Event('app:operations-data-updated'));
      window.dispatchEvent(new Event('app:notifications-changed'));
      setForm((prev) => ({
        ...prev,
        quantity: '',
        unit_price: '',
        customer_name: '',
        region: '',
        notes: ''
      }));
      await loadData();
    } catch (e) {
      console.error('Failed to create stock transaction:', e);
      setError(e?.message || 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  const exportStockCsv = async () => {
    try {
      const token = localStorage.getItem('token');
      const query = new URLSearchParams();
      if (rangePreset === 'custom') {
        if (!fromDate || !toDate) {
          setError('Please select both start and end dates for custom range.');
          return;
        }
        if (fromDate > toDate) {
          setError('Start date cannot be after end date.');
          return;
        }
        query.set('from_date', fromDate);
        query.set('to_date', toDate);
      } else {
        query.set('days', rangePreset);
      }
      const response = await fetch(`http://localhost:3001/api/inventory/report/csv?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('Failed to generate CSV report');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/i);
      const filenameFromServer = match?.[1];
      const a = document.createElement('a');
      a.href = url;
      a.download = filenameFromServer || `inventory-stock-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to download inventory CSV:', e);
      setError(e?.message || 'Failed to download report');
    }
  };

  const handleOrderFromRecommendation = (rec) => {
    const suggestedQty = Number(rec?.effective_order_quantity ?? rec?.optimal_order_quantity ?? 0);
    if (!rec?.product_id || suggestedQty <= 0) {
      setError('Recommendation is missing product or quantity.');
      return;
    }
    setForm((prev) => ({
      ...prev,
      product_id: String(rec.product_id),
      transaction_type: 'ordered',
      quantity: String(Math.max(1, suggestedQty)),
      notes: `AI recommendation: ${rec.reasoning || 'Inventory optimization recommendation'}`
    }));
    setPrefillNotice('Prefilled from AI recommendation. Please add supplier/source and region, then record transaction.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Stock Transactions</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Record product stock in/out, sold, and ordered movements.
          </p>
        </div>
        <Button variant="outline" onClick={exportStockCsv}>
          Generate Stock CSV Report
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <Select value={rangePreset} onValueChange={setRangePreset}>
          <SelectTrigger>
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="180">Last 180 days</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          disabled={rangePreset !== 'custom'}
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <Input
          type="date"
          disabled={rangePreset !== 'custom'}
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
        <div className="md:col-span-2 flex items-center gap-2">
          <Button type="button" onClick={loadData}>
            Apply Range
          </Button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            History and CSV use this date range.
          </span>
        </div>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">Today revenue</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {formatCurrency(salesSummary.todayRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">This month sold units</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {salesSummary.monthUnits.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">Top region by revenue</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {salesSummary.topRegion}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatCurrency(salesSummary.topRegionRevenue)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            AI Procurement Recommendations
          </CardTitle>
          <CardDescription>Smart inventory optimization suggestions. Click "Create Order" to prefill the transaction form.</CardDescription>
        </CardHeader>
        <CardContent>
          {recommendations.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
              <p className="text-sm">No recommendations available yet.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {recommendations.map((rec, idx) => (
                <div
                  key={`${rec.product_id}-${idx}`}
                  className="border border-purple-200 dark:border-purple-900/50 rounded-lg p-4 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                          {rec.product_name || 'Unknown Product'}
                        </h4>
                        <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                          {rec.sku || 'N/A'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {rec.reasoning || 'Inventory optimization recommendation'}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Current: </span>
                          <span className="font-semibold">{rec.current_stock ?? rec.available_stock ?? 0}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Reorder Pt: </span>
                          <span className="font-semibold">{rec.reorder_point ?? '-'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Qty to Order: </span>
                          <span className="font-semibold text-purple-600">{rec.effective_order_quantity ?? rec.optimal_order_quantity ?? 0}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Risk: </span>
                          <span className={`font-semibold ${rec.risk_level === 'critical' ? 'text-red-600' : rec.risk_level === 'high' ? 'text-amber-600' : 'text-green-600'}`}>
                            {rec.risk_level || 'Normal'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={() => handleOrderFromRecommendation(rec)}
                    >
                      Create Order
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New Transaction</CardTitle>
          <CardDescription>Every stock movement is saved and included in report exports.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {prefillNotice && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              {prefillNotice}
            </div>
          )}
          <form className="grid grid-cols-1 md:grid-cols-4 gap-3" onSubmit={handleSubmit}>
            <Select
              value={form.product_id}
              onValueChange={(value) => setForm((prev) => ({ ...prev, product_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} ({p.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={form.transaction_type}
              onValueChange={(value) => setForm((prev) => ({ ...prev, transaction_type: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TXN_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              min="1"
              placeholder="Quantity"
              value={form.quantity}
              onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
            />

            <Input
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />

            {(form.transaction_type === 'sold' || form.transaction_type === 'stock_out') && (
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={form.transaction_type === 'sold' ? 'Unit price (for revenue)' : 'Unit amount (optional)'}
                value={form.unit_price}
                onChange={(e) => setForm((prev) => ({ ...prev, unit_price: e.target.value }))}
              />
            )}

            {(form.transaction_type === 'sold' || form.transaction_type === 'stock_out' || form.transaction_type === 'ordered') && (
              <Input
                placeholder={form.transaction_type === 'ordered' ? 'Supplier / Source (optional)' : 'Customer name (optional)'}
                value={form.customer_name}
                onChange={(e) => setForm((prev) => ({ ...prev, customer_name: e.target.value }))}
              />
            )}

            {(form.transaction_type === 'sold' || form.transaction_type === 'stock_out' || form.transaction_type === 'ordered') && (
              <Input
                placeholder={form.transaction_type === 'ordered' ? 'Source region (optional)' : 'Region (optional)'}
                value={form.region}
                onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value }))}
              />
            )}

            <div className="md:col-span-4">
              {form.transaction_type === 'sold' && form.quantity && form.unit_price && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Sale amount preview: {formatCurrency(Number(form.quantity || 0) * Number(form.unit_price || 0))}
                </p>
              )}
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Record Transaction'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Latest stock movements used for reports and alerts.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Package className="w-12 h-12 mx-auto opacity-50 mb-2" />
              <p>No transactions yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((t) => {
                const txnColor = {
                  'stock_in': 'border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/20',
                  'stock_out': 'border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20',
                  'sold': 'border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/20',
                  'ordered': 'border-l-4 border-l-purple-500 bg-purple-50 dark:bg-purple-950/20',
                  'adjustment_in': 'border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20',
                  'adjustment_out': 'border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-950/20'
                }[t.transaction_type] || 'border-l-4 border-l-gray-400 bg-gray-50 dark:bg-gray-800/20';

                return (
                  <div key={t.id} className={`p-4 rounded-lg ${txnColor}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                            {t.product_name || '-'}
                          </h4>
                          <span className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {t.sku || '-'}
                          </span>
                          <Badge variant="outline">
                            {transactionLabelMap[t.transaction_type] || t.transaction_type}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-sm">
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Qty: </span>
                            <span className="font-semibold">{t.quantity}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Amount: </span>
                            <span className="font-semibold">{getTxnAmount(t) != null ? formatCurrency(getTxnAmount(t)) : '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Stock Change: </span>
                            <span className="font-semibold">{t.previous_stock ?? '?'} → {t.new_stock ?? '?'}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Date: </span>
                            <span className="font-semibold text-xs">{new Date(t.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        {(t.customer_name || t.region) && (
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                            {t.customer_name && <span>Customer: <span className="font-medium text-gray-900 dark:text-gray-100">{t.customer_name}</span></span>}
                            {t.region && <span>Region: <span className="font-medium text-gray-900 dark:text-gray-100">{t.region}</span></span>}
                          </div>
                        )}
                        {t.notes && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">
                            Note: {t.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 sm:flex-col sm:items-end">
                        <span>By: {t.user_name || 'System'}</span>
                        <span>{new Date(t.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-neutral-700 text-sm text-gray-600 dark:text-gray-400">
                <strong>Summary:</strong> Total amount (Sold + Stock Out) in this view: <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(transactionAmountSummary.total)}</span>
                {transactionAmountSummary.count > 0 ? ` from ${transactionAmountSummary.count} transaction(s)` : ''}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
