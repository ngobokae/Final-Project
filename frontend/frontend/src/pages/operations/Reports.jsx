import { useState, useEffect } from 'react';
import { FileText, Download, Calendar, BarChart3, TrendingUp, Package, DollarSign, Loader2, ArrowUpDown } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { apiGet } from '../../utils/api';
import { downloadCsvReport, downloadExcelReport, downloadPdfReport } from '../../utils/reportExport';
import ReportDateRangePicker from '../../components/ReportDateRangePicker';
import { validateReportDateRange, buildReportQueryString, formatReportDateRangeLabel } from '../../utils/reportDateRange';

export default function OperationsReports() {
  const [selectedReport, setSelectedReport] = useState('sales');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [lastGeneratedReportId, setLastGeneratedReportId] = useState('');

  useEffect(() => {
    setReportData(null);
    setLastGeneratedReportId('');
  }, [startDate, endDate]);

  const reports = [
    {
      id: 'sales',
      name: 'Sales Report',
      icon: DollarSign,
      description: 'Detailed sales analysis by product and region',
      endpoint: '/api/reports/sales'
    },
    {
      id: 'production',
      name: 'Production Report',
      icon: Package,
      description: 'Production output and efficiency metrics',
      endpoint: '/api/reports/production'
    },
    {
      id: 'demand',
      name: 'Demand Forecast Report',
      icon: TrendingUp,
      description: 'AI-powered demand predictions',
      endpoint: '/api/reports/demand-forecast'
    },
    {
      id: 'performance',
      name: 'Performance Report',
      icon: BarChart3,
      description: 'Overall operations performance summary',
      endpoint: '/api/reports/executive-summary'
    },
    {
      id: 'inventory-transactions',
      name: 'Inventory Transactions',
      icon: ArrowUpDown,
      description: 'Recent stock movements, orders, and procurement history',
      endpoint: '/api/reports/inventory-transactions'
    }
  ];

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <FileText className="w-7 h-7 text-emerald-600" />
          Operations Reports
        </h1>
        <p className="text-gray-500 mt-1">Generate and download operations reports</p>
      </div>

      {/* Report Generator */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Generate Report</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
            <select
              value={selectedReport}
              onChange={(e) => setSelectedReport(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
            accentClass="focus:ring-emerald-500"
          />
          <div className="flex items-end">
            <button
              onClick={handleGenerateReport}
              disabled={generating || !startDate || !endDate}
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <Icon className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{report.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{report.description}</p>
                    {reportData && lastGeneratedReportId === report.id && (
                      <div className="flex items-center gap-1 text-xs text-emerald-600 mt-2">
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
                  className="flex-1 min-w-[140px] px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
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

      {/* Report Results */}
      {reportData && (
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Report Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {Object.entries(reportData.summary || {}).slice(0, 6).map(([key, value]) => (
              <div key={key} className="p-3 bg-gray-50 dark:bg-neutral-800 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">{key.replace(/_/g, ' ')}</div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {typeof value === 'number' ? (value % 1 === 0 ? value.toLocaleString() : value.toFixed(2)) : value}
                </div>
              </div>
            ))}
          </div>
          {reportData.details && reportData.details.length > 0 && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {reportData.details.length} records found
            </div>
          )}
          {reportData.type === 'inventory_transactions' && reportData.details?.length > 0 && (
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
          )}
          {reportData.type === 'executive_summary' && reportData.recent_transactions?.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Recent Transaction History</h3>
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
