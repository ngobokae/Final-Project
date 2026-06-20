import { useState, useEffect } from 'react';
import { FileText, Download, Calendar, DollarSign, BarChart3, Loader2, ArrowUpDown } from 'lucide-react';
import { apiGet } from '../../utils/api';
import { formatCurrency } from '../../utils/currency';
import { downloadCsvReport, downloadExcelReport, downloadPdfReport } from '../../utils/reportExport';

export default function ExecutiveReports() {
  const [selectedReport, setSelectedReport] = useState('executive');
  const [dateRange, setDateRange] = useState('month');
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [lastGeneratedReportId, setLastGeneratedReportId] = useState('');
  const [metrics, setMetrics] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState(null);

  const reports = [
    {
      id: 'executive',
      name: 'Executive Summary',
      icon: BarChart3,
      description: 'High-level overview of all business metrics',
      endpoint: '/api/reports/executive-summary'
    },
    {
      id: 'financial',
      name: 'Financial Report',
      icon: DollarSign,
      description: 'Revenue, costs, and profitability analysis',
      endpoint: '/api/reports/financial'
    },
    {
      id: 'inventory-transactions',
      name: 'Inventory Transactions',
      icon: ArrowUpDown,
      description: 'Recent stock movements and procurement history',
      endpoint: '/api/reports/inventory-transactions'
    }
  ];

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const data = await apiGet('/api/reports/executive-summary?days=30');
      if (data.report) {
        setMetrics({
          revenue: data.report.sales?.net_revenue ?? data.report.sales?.revenue ?? 0,
          predictionRevenue: data.report.sales?.prediction_revenue ?? 0,
          profit: (data.report.sales?.net_revenue ?? data.report.sales?.revenue ?? 0) - (data.report.procurement?.delivered_spend || data.report.procurement?.total_spend || 0),
          orders: data.report.sales?.transactions || 0,
          avgOrderValue: data.report.sales?.avg_order_value || 0
        });
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  const getDaysFromRange = (range) => {
    const map = { week: 7, month: 30, quarter: 90, year: 365 };
    return map[range] || 30;
  };

  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      const report = reports.find(r => r.id === selectedReport);
      if (!report) return;

      const days = getDaysFromRange(dateRange);
      const data = await apiGet(`${report.endpoint}?days=${days}`);
      setReportData(data.report);
      setLastGeneratedReportId(report.id);
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const fetchReportById = async (reportId) => {
    const report = reports.find(r => r.id === reportId);
    if (!report) return null;
    const days = getDaysFromRange(dateRange);
    const data = await apiGet(`${report.endpoint}?days=${days}`);
    return { reportConfig: report, reportData: data.report };
  };

  const handleDownloadCsv = async (reportId) => {
    try {
      const result = await fetchReportById(reportId);
      if (!result) return;
      downloadCsvReport(result.reportData, `${reportId}-report`, `${result.reportConfig.name} Report`);
    } catch (error) {
      console.error('Failed to download report CSV:', error);
      alert('Failed to download report CSV.');
    }
  };

  const handleDownloadExcel = async (reportId) => {
    try {
      const result = await fetchReportById(reportId);
      if (!result) return;
      await downloadExcelReport(result.reportData, `${result.reportConfig.name} Report`, `${reportId}-report`);
    } catch (error) {
      console.error('Failed to download Excel report:', error);
      alert('Failed to download Excel report.');
    }
  };

  const handleDownloadPdf = async (reportId) => {
    try {
      const result = await fetchReportById(reportId);
      if (!result) return;
      await downloadPdfReport(
        result.reportData,
        `${result.reportConfig.name} Report`,
        `${reportId}-report`
      );
    } catch (error) {
      console.error('Failed to download PDF report:', error);
      alert('Failed to download PDF report.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-7 h-7 text-amber-500" />
          Executive Reports
        </h1>
        <p className="text-gray-500 mt-1">Generate and download executive reports</p>
      </div>

      {/* Report Generator */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Report</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
            <select
              value={selectedReport}
              onChange={(e) => setSelectedReport(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              {reports.map((report) => (
                <option key={report.id} value={report.id}>{report.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="quarter">Last Quarter</option>
              <option value="year">Last Year</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleGenerateReport}
              disabled={generating}
              className="w-full px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <BarChart3 className="w-5 h-5" />
                  Generate Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Available Reports */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <div key={report.id} className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Icon className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{report.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                    {reportData && lastGeneratedReportId === report.id && (
                      <div className="flex items-center gap-1 text-xs text-amber-600 mt-2">
                        <Calendar className="w-3 h-3" />
                        Generated: {new Date().toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleDownloadCsv(report.id)}
                  className="flex-1 min-w-[140px] px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download CSV
                </button>
                <button
                  onClick={() => handleDownloadExcel(report.id)}
                  className="flex-1 min-w-[140px] px-3 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download Excel
                </button>
                <button
                  onClick={() => handleDownloadPdf(report.id)}
                  className="flex-1 min-w-[120px] px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Metrics */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">This Month at a Glance</h2>
          {selectedMetric && (
            <button
              onClick={() => setSelectedMetric(null)}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
            >
              Clear Selection
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div 
            onClick={() => setSelectedMetric(selectedMetric === 'revenue' ? null : 'revenue')}
            className={`p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg cursor-pointer transition-all hover:scale-105 hover:shadow-md ${
              selectedMetric === 'revenue' ? 'ring-2 ring-emerald-500 shadow-lg' : ''
            }`}
          >
            <div className="text-sm text-emerald-600 font-medium">Total Revenue</div>
            <div className="text-2xl font-bold text-emerald-900">
              {formatCurrency(metrics?.revenue || 0)}
            </div>
            <div className="text-xs text-emerald-600 mt-1">Last 30 days</div>
          </div>
          <div 
            onClick={() => setSelectedMetric(selectedMetric === 'profit' ? null : 'profit')}
            className={`p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg cursor-pointer transition-all hover:scale-105 hover:shadow-md ${
              selectedMetric === 'profit' ? 'ring-2 ring-blue-500 shadow-lg' : ''
            }`}
          >
            <div className="text-sm text-blue-600 font-medium">Gross Profit</div>
            <div className="text-2xl font-bold text-blue-900">
              {formatCurrency(metrics?.profit || 0)}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              {metrics?.revenue ? ((metrics.profit / metrics.revenue) * 100).toFixed(1) + '% margin' : '—'}
            </div>
          </div>
          <div 
            onClick={() => setSelectedMetric(selectedMetric === 'orders' ? null : 'orders')}
            className={`p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg cursor-pointer transition-all hover:scale-105 hover:shadow-md ${
              selectedMetric === 'orders' ? 'ring-2 ring-purple-500 shadow-lg' : ''
            }`}
          >
            <div className="text-sm text-purple-600 font-medium">Orders</div>
            <div className="text-2xl font-bold text-purple-900">{metrics?.orders?.toLocaleString() || '0'}</div>
            <div className="text-xs text-purple-600 mt-1">Last 30 days</div>
          </div>
          <div 
            onClick={() => setSelectedMetric(selectedMetric === 'aov' ? null : 'aov')}
            className={`p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg cursor-pointer transition-all hover:scale-105 hover:shadow-md ${
              selectedMetric === 'aov' ? 'ring-2 ring-amber-500 shadow-lg' : ''
            }`}
          >
            <div className="text-sm text-amber-600 font-medium">Avg Order Value</div>
            <div className="text-2xl font-bold text-amber-900">
              {formatCurrency(metrics?.avgOrderValue || 0)}
            </div>
            <div className="text-xs text-amber-600 mt-1">Per transaction</div>
          </div>
        </div>
      </div>

      {/* Report Results */}
      {reportData && (
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Summary</h2>
          {reportData.type === 'executive_summary' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-neutral-800 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Sales</h3>
                <div className="space-y-1 text-sm">
                  <div>Revenue: {formatCurrency(reportData.sales?.revenue || 0)}</div>
                  <div>Units Sold: {(reportData.sales?.units_sold || 0).toLocaleString()}</div>
                  <div>Transactions: {reportData.sales?.transactions || 0}</div>
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-neutral-800 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Production</h3>
                <div className="space-y-1 text-sm">
                  <div>Plans: {reportData.production?.plans || 0}</div>
                  <div>Target Units: {(reportData.production?.target_units || 0).toLocaleString()}</div>
                  <div>Completed: {(reportData.production?.completed_units || 0).toLocaleString()}</div>
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-neutral-800 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Inventory</h3>
                <div className="space-y-1 text-sm">
                  <div>Value: {formatCurrency(reportData.inventory?.inventory_value || 0)}</div>
                  <div>Active Products: {reportData.inventory?.active_products || 0}</div>
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-neutral-800 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Procurement</h3>
                <div className="space-y-1 text-sm">
                  <div>Orders: {reportData.procurement?.orders || 0}</div>
                  <div>Total Spend: {formatCurrency(reportData.procurement?.total_spend || 0)}</div>
                  <div>Completed: {reportData.procurement?.delivered_orders || 0}</div>
                  <div>Delivered Value: {formatCurrency(reportData.procurement?.delivered_spend || 0)}</div>
                </div>
              </div>
            </div>
          ) : reportData.type === 'inventory_transactions' && reportData.details?.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(reportData.summary || {}).slice(0, 6).map(([key, value]) => (
                  <div key={key} className="p-3 bg-gray-50 dark:bg-neutral-800 rounded-lg">
                    <div className="text-xs text-gray-500 uppercase">{key.replace(/_/g, ' ')}</div>
                    <div className="text-lg font-bold text-gray-900">
                      {typeof value === 'number' && (key.includes('value') || key.includes('revenue'))
                        ? formatCurrency(value)
                        : typeof value === 'number'
                          ? (value % 1 === 0 ? value.toLocaleString() : value.toFixed(2))
                          : value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-neutral-800">
                    <tr>
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Product</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-right p-2">Qty</th>
                      <th className="text-right p-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.details.slice(0, 15).map((row) => (
                      <tr key={row.id} className="border-t border-gray-100 dark:border-neutral-800">
                        <td className="p-2">{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                        <td className="p-2">{row.product_name || '-'}</td>
                        <td className="p-2">{String(row.transaction_type || '-').replace(/_/g, ' ')}</td>
                        <td className="p-2 text-right">{row.quantity ?? '-'}</td>
                        <td className="p-2 text-right">{row.total_amount != null ? formatCurrency(row.total_amount) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(reportData.summary || {}).slice(0, 6).map(([key, value]) => (
                <div key={key} className="p-3 bg-gray-50 dark:bg-neutral-800 rounded-lg">
                  <div className="text-xs text-gray-500 uppercase">{key.replace(/_/g, ' ')}</div>
                  <div className="text-lg font-bold text-gray-900">
                    {typeof value === 'number' ? (value % 1 === 0 ? value.toLocaleString() : value.toFixed(2)) : value}
                  </div>
                </div>
              ))}
            </div>
          )}
          {reportData.type === 'executive_summary' && reportData.recent_transactions?.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-gray-900 mb-3">Recent Transaction History</h3>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-neutral-800">
                    <tr>
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Product</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-right p-2">Qty</th>
                      <th className="text-right p-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.recent_transactions.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="border-t border-gray-100 dark:border-neutral-800">
                        <td className="p-2">{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                        <td className="p-2">{row.product_name || '-'}</td>
                        <td className="p-2">{String(row.transaction_type || '-').replace(/_/g, ' ')}</td>
                        <td className="p-2 text-right">{row.quantity ?? '-'}</td>
                        <td className="p-2 text-right">{row.total_amount != null ? formatCurrency(row.total_amount) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
