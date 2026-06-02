import { useState } from 'react';
import { FileText, Download, Calendar, Filter, BarChart3, TrendingUp, Package, DollarSign, Loader2 } from 'lucide-react';
import { apiGet } from '../../utils/api';
import { downloadCsvReport } from '../../utils/reportExport';

export default function OperationsReports() {
  const [selectedReport, setSelectedReport] = useState('sales');
  const [dateRange, setDateRange] = useState('month');
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [lastGeneratedReportId, setLastGeneratedReportId] = useState('');

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
    }
  ];

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
      downloadCsvReport(result.reportData, `${reportId}-report`);
    } catch (error) {
      console.error('Failed to download report:', error);
      alert('Failed to download report.');
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                        Generated: {new Date().toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleDownloadCsv(report.id)}
                  className="flex-1 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download CSV
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
            <div className="text-sm text-gray-600">
              {reportData.details.length} records found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
