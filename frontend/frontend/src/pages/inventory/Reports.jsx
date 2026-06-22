import { useState, useEffect } from 'react';
import { FileText, Download, Calendar, Package, TrendingDown, TrendingUp, BarChart3, Loader2 } from 'lucide-react';
import { apiGet } from '../../utils/api';
import { downloadCsvReport, downloadExcelReport, downloadPdfReport } from '../../utils/reportExport';
import ReportDateRangePicker from '../../components/ReportDateRangePicker';
import { validateReportDateRange, buildReportQueryString, formatReportDateRangeLabel } from '../../utils/reportDateRange';

export default function InventoryReports() {
  const [selectedReport, setSelectedReport] = useState('stock');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [lastGeneratedReportId, setLastGeneratedReportId] = useState('');
  const [inventoryStats, setInventoryStats] = useState(null);

  const reports = [
    {
      id: 'stock',
      name: 'Stock Level Report',
      icon: Package,
      description: 'Current inventory levels across all products',
      endpoint: '/api/reports/stock-level'
    },
    {
      id: 'valuation',
      name: 'Inventory Valuation',
      icon: BarChart3,
      description: 'Total value of inventory by category',
      endpoint: '/api/reports/inventory-valuation'
    },
    {
      id: 'forecast-errors',
      name: 'Forecast Error Report',
      icon: TrendingDown,
      description: 'Forecast accuracy metrics with MAE, RMSE and MAPE by SKU',
      endpoint: '/api/reports/inventory-forecast-errors'
    },
    {
      id: 'abc-analysis',
      name: 'ABC Inventory Analysis',
      icon: BarChart3,
      description: 'Categorize SKUs into A/B/C by inventory value importance',
      endpoint: '/api/reports/inventory-abc-analysis'
    }
  ];

  useEffect(() => {
    fetchInventoryStats();
  }, []);

  useEffect(() => {
    setReportData(null);
    setLastGeneratedReportId('');
  }, [startDate, endDate]);

  const fetchInventoryStats = async () => {
    try {
      const data = await apiGet('/api/inventory');
      const inventory = data.inventory || [];
      const stats = {
        total_skus: inventory.length,
        in_stock: inventory.filter(i => (i.available_stock || 0) >= (i.reorder_point || 0)).length,
        low_stock: inventory.filter(i => {
          const stock = i.available_stock || 0;
          const safety = i.safety_stock || 0;
          const reorder = i.reorder_point || 0;
          return stock > safety && stock < reorder;
        }).length,
        out_of_stock: inventory.filter(i => (i.available_stock || 0) <= (i.safety_stock || 0)).length
      };
      setInventoryStats(stats);
    } catch (error) {
      console.error('Failed to fetch inventory stats:', error);
    }
  };

  const getDateRangeError = () => validateReportDateRange(startDate, endDate);

  const handleGenerateReport = async () => {
    const dateError = getDateRangeError();
    if (dateError) {
      alert(dateError);
      return;
    }

    try {
      setGenerating(true);
      const report = reports.find(r => r.id === selectedReport);
      if (!report) return;

      const data = await apiGet(`${report.endpoint}?${buildReportQueryString(startDate, endDate)}`);
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
    const dateError = getDateRangeError();
    if (dateError) {
      alert(dateError);
      return null;
    }

    const report = reports.find(r => r.id === reportId);
    if (!report) return null;
    const data = await apiGet(`${report.endpoint}?${buildReportQueryString(startDate, endDate)}`);
    return { reportConfig: report, reportData: data.report };
  };

  const handleDownloadCsv = async (reportId) => {
    try {
      const result = await fetchReportById(reportId);
      if (!result) return;
      downloadCsvReport(result.reportData, `${reportId}-report`, `${result.reportConfig.name} Report`);
    } catch (error) {
      console.error('Failed to download report:', error);
      alert('Failed to download report.');
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
          <FileText className="w-7 h-7 text-purple-600" />
          Inventory Reports
        </h1>
        <p className="text-gray-500 mt-1">Generate and download inventory reports</p>
      </div>

      {/* Report Generator */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Report</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
            <select
              value={selectedReport}
              onChange={(e) => setSelectedReport(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {reports.map((report) => (
                <option key={report.id} value={report.id}>{report.name}</option>
              ))}
            </select>
          </div>
          <ReportDateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            accentClass="focus:ring-purple-500"
          />
          <div className="flex items-end">
            <button
              onClick={handleGenerateReport}
              disabled={generating || !startDate || !endDate}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
        <p className="text-sm text-gray-500 mt-3">
          Select a start and end date to generate or download reports for that period only.
        </p>
      </div>

      {/* Available Reports */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <div key={report.id} className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Icon className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{report.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                    {reportData && lastGeneratedReportId === report.id && (
                      <div className="flex items-center gap-1 text-xs text-purple-600 mt-2">
                        <Calendar className="w-3 h-3" />
                        Period: {formatReportDateRangeLabel(startDate, endDate)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2 flex-wrap">
                <button
                  onClick={() => handleDownloadCsv(report.id)}
                  disabled={!startDate || !endDate}
                  className="flex-1 min-w-[140px] px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Download CSV
                </button>
                <button
                  onClick={() => handleDownloadExcel(report.id)}
                  disabled={!startDate || !endDate}
                  className="flex-1 min-w-[120px] px-3 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Excel
                </button>
                <button
                  onClick={() => handleDownloadPdf(report.id)}
                  disabled={!startDate || !endDate}
                  className="flex-1 min-w-[120px] px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Inventory Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-sm text-purple-600 font-medium">Total SKUs</div>
            <div className="text-2xl font-bold text-purple-900">{inventoryStats?.total_skus || 0}</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-sm text-green-600 font-medium">In Stock</div>
            <div className="text-2xl font-bold text-green-900">{inventoryStats?.in_stock || 0}</div>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg">
            <div className="text-sm text-amber-600 font-medium">Low Stock</div>
            <div className="text-2xl font-bold text-amber-900">{inventoryStats?.low_stock || 0}</div>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <div className="text-sm text-red-600 font-medium">Out of Stock</div>
            <div className="text-2xl font-bold text-red-900">{inventoryStats?.out_of_stock || 0}</div>
          </div>
        </div>
      </div>

      {/* Report Results */}
      {reportData && (
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {Object.entries(reportData.summary || {}).slice(0, 6).map(([key, value]) => (
              <div key={key} className="p-3 bg-gray-50 dark:bg-neutral-800 rounded-lg">
                <div className="text-xs text-gray-500 uppercase">{key.replace(/_/g, ' ')}</div>
                <div className="text-lg font-bold text-gray-900">
                  {typeof value === 'number' ? (value % 1 === 0 ? value.toLocaleString() : value.toFixed(2)) : value}
                </div>
              </div>
            ))}
          </div>
          {reportData.details && reportData.details.length > 0 && (
            <div className="text-sm text-gray-600">
              {reportData.details.length} records found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
