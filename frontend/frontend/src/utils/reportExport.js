import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import logoSrc from '../assets/IMG_1472.PNG';

const COMPANY_NAME = 'Kinglion Rwanda Investment Ltd';
const REPORT_SUBTITLE = 'Manufacturing & Supply Chain Intelligence';

const CURRENCY_KEY = /revenue|amount|value|cost|price|spend|profit|mae|rmse|mape/i;
const HIDDEN_COLUMNS = new Set([
  'id', 'product_id', 'created_by', 'updated_at', 'created_at', 'details', 'notes', 'user_id'
]);

const COLUMN_LABELS = {
  date: 'Date',
  forecast_date: 'Forecast Date',
  product_name: 'Product',
  sku: 'SKU',
  category: 'Category',
  transaction_type: 'Transaction Type',
  transaction_count: 'Transactions',
  total_quantity: 'Quantity',
  quantity: 'Quantity',
  total_revenue: 'Revenue (FRW)',
  total_amount: 'Amount (FRW)',
  avg_price: 'Avg Unit Price',
  unit_price: 'Unit Price',
  unit_cost: 'Unit Cost',
  forecasted_demand: 'Forecasted Demand',
  confidence_level: 'Confidence',
  completion_rate: 'Completion %',
  status: 'Status',
  priority: 'Priority',
  target_quantity: 'Target Qty',
  completed_quantity: 'Completed Qty',
  start_date: 'Start Date',
  end_date: 'End Date',
  current_stock: 'Current Stock',
  available_stock: 'Available Stock',
  stock_status: 'Stock Status',
  stock_value: 'Stock Value (FRW)',
  abc_category: 'ABC Class',
  value_share: 'Value Share %',
  cumulative_share: 'Cumulative %',
  absolute_error: 'Absolute Error',
  percent_error: 'Error %',
  error_direction: 'Direction',
  actual: 'Actual',
  user_name: 'Recorded By',
  region: 'Region',
  customer_name: 'Customer',
};

const escapeCsv = (value) => {
  if (value == null) return '';
  const text = String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const formatLabel = (key) =>
  COLUMN_LABELS[key] ||
  String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatCellValue = (key, value) => {
  if (value == null || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    } catch {
      /* keep raw */
    }
  }
  if (typeof value === 'number') {
    if (CURRENCY_KEY.test(String(key))) {
      return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    if (key === 'confidence_level' && value <= 1) {
      return `${Math.round(value * 100)}%`;
    }
    return Number.isInteger(value) ? value : Math.round(value * 100) / 100;
  }
  return String(value).replace(/_/g, ' ');
};

const getPeriodLabel = (report) => {
  if (!report) return 'All available data';
  if (report.period && typeof report.period === 'object') {
    const { start, end } = report.period;
    if (start && end) return `${start} to ${end}`;
  }
  if (report.period != null) return `Last ${report.period} days`;
  return 'Current snapshot';
};

const getReportTypeLabel = (report) => {
  const map = {
    sales: 'Sales Report',
    production: 'Production Report',
    demand_forecast: 'Demand Forecast Report',
    executive_summary: 'Executive Summary Report',
    inventory_transactions: 'Inventory Transactions Report',
    stock_level: 'Stock Level Report',
    inventory_valuation: 'Inventory Valuation Report',
    inventory_forecast_error: 'Forecast Error Report',
    inventory_abc_analysis: 'ABC Inventory Analysis',
    financial: 'Financial Performance Report',
  };
  return map[report?.type] || 'Operations Report';
};

const pickColumns = (rows) => {
  if (!rows?.length) return [];
  const keys = new Set();
  rows.forEach((row) => {
    Object.keys(row || {}).forEach((k) => {
      if (!HIDDEN_COLUMNS.has(k)) keys.add(k);
    });
  });
  const preferred = Object.keys(COLUMN_LABELS).filter((k) => keys.has(k));
  const rest = Array.from(keys).filter((k) => !preferred.includes(k)).sort();
  return [...preferred, ...rest];
};

const rowsToTable = (rows) => {
  const columns = pickColumns(rows);
  const headers = columns.map(formatLabel);
  const body = rows.map((row) =>
    columns.map((col) => formatCellValue(col, row?.[col]))
  );
  return { columns, headers, body, rows };
};

const kvSection = (title, obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const entries = Object.entries(obj).filter(([, v]) => v != null && v !== '');
  if (!entries.length) return null;
  return {
    title,
    type: 'kv',
    headers: ['Metric', 'Value'],
    body: entries.map(([k, v]) => [formatLabel(k), formatCellValue(k, v)]),
  };
};

/** Build structured sections for multi-table reports */
export const getReportSections = (report) => {
  if (!report) return [];

  if (report.type === 'executive_summary') {
    const sections = [
      kvSection('Sales Performance', report.sales),
      kvSection('Production Overview', report.production),
      kvSection('Inventory Snapshot', report.inventory),
      kvSection('Procurement Overview', report.procurement),
    ].filter(Boolean);
    if (report.recent_transactions?.length) {
      const table = rowsToTable(report.recent_transactions);
      sections.push({ title: 'Recent Transaction History', type: 'table', ...table });
    }
    return sections;
  }

  if (report.type === 'financial') {
    const sections = [];
    const summary = kvSection('Financial Summary', report.summary);
    if (summary) sections.push(summary);
    if (report.revenue?.length) {
      const table = rowsToTable(report.revenue);
      sections.push({ title: 'Daily Revenue', type: 'table', ...table });
    }
    if (report.costs?.length) {
      const table = rowsToTable(report.costs);
      sections.push({ title: 'Daily Procurement Costs', type: 'table', ...table });
    }
    return sections;
  }

  const sections = [];
  const summary = kvSection('Summary', report.summary);
  if (summary) sections.push(summary);

  const detailRows = Array.isArray(report.details) ? report.details : [];
  if (detailRows.length) {
    const table = rowsToTable(detailRows);
    sections.push({
      title: report.type === 'inventory_transactions' ? 'Transaction Details' : 'Detailed Records',
      type: 'table',
      ...table,
    });
  }

  return sections;
};

export const buildCsvContent = (report, title) => {
  const reportTitle = title || getReportTypeLabel(report);
  const generated = new Date().toLocaleString();
  const period = getPeriodLabel(report);
  const sections = getReportSections(report);
  const lines = [];

  lines.push(COMPANY_NAME);
  lines.push(reportTitle);
  lines.push(REPORT_SUBTITLE);
  lines.push(`Generated,${escapeCsv(generated)}`);
  lines.push(`Reporting Period,${escapeCsv(period)}`);
  lines.push(`Report Type,${escapeCsv(report?.type || 'general')}`);
  lines.push('');

  if (!sections.length) {
    lines.push('No data available for this report.');
    return lines.join('\n');
  }

  sections.forEach((section, index) => {
    if (index > 0) lines.push('');
    lines.push(section.title.toUpperCase());
    lines.push(section.headers.map(escapeCsv).join(','));
    section.body.forEach((row) => {
      lines.push(row.map(escapeCsv).join(','));
    });
  });

  lines.push('');
  lines.push(`End of report — ${COMPANY_NAME}`);
  return lines.join('\n');
};

export const reportToCsv = (report, title) => buildCsvContent(report, title);

export const downloadCsvReport = (report, fileNameBase, title) => {
  const csv = buildCsvContent(report, title);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileNameBase}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const getImageBase64 = async (src) => {
  try {
    let url = src;
    if (typeof src === 'string' && !src.startsWith('http') && !src.startsWith('data:')) {
      if (typeof window !== 'undefined') {
        url = new URL(src, window.location.origin).href;
      }
    }
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') resolve(result.split(',')[1]);
        else reject(new Error('Unable to convert image to base64'));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('Could not load logo for export', e);
    return null;
  }
};

const styleExcelHeaderRow = (row) => {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1E3A8A' } },
      left: { style: 'thin', color: { argb: 'FF1E3A8A' } },
      bottom: { style: 'thin', color: { argb: 'FF1E3A8A' } },
      right: { style: 'thin', color: { argb: 'FF1E3A8A' } },
    };
  });
};

const styleExcelDataRows = (sheet, startRow, endRow, colCount) => {
  for (let r = startRow; r <= endRow; r += 1) {
    const row = sheet.getRow(r);
    const isAlt = (r - startRow) % 2 === 1;
    for (let c = 1; c <= colCount; c += 1) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      cell.alignment = { vertical: 'middle', wrapText: true };
      if (isAlt) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    }
  }
};

const autoSizeColumns = (sheet, colCount, startRow, endRow) => {
  for (let c = 1; c <= colCount; c += 1) {
    let maxLen = 12;
    for (let r = startRow; r <= endRow; r += 1) {
      const val = sheet.getRow(r).getCell(c).value;
      const len = val == null ? 0 : String(val).length;
      maxLen = Math.max(maxLen, Math.min(len + 2, 42));
    }
    sheet.getColumn(c).width = maxLen;
  }
};

const addExcelReportHeader = (sheet, title, report, logoBase64, workbook) => {
  sheet.mergeCells('A1:H1');
  sheet.getCell('A1').value = COMPANY_NAME;
  sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF0F172A' } };
  sheet.getCell('A1').alignment = { vertical: 'middle' };

  sheet.mergeCells('A2:H2');
  sheet.getCell('A2').value = title || getReportTypeLabel(report);
  sheet.getCell('A2').font = { size: 14, bold: true, color: { argb: 'FF1D4ED8' } };

  sheet.mergeCells('A3:H3');
  sheet.getCell('A3').value = REPORT_SUBTITLE;
  sheet.getCell('A3').font = { size: 10, italic: true, color: { argb: 'FF64748B' } };

  sheet.mergeCells('A4:D4');
  sheet.getCell('A4').value = `Generated: ${new Date().toLocaleString()}`;
  sheet.mergeCells('E4:H4');
  sheet.getCell('E4').value = `Period: ${getPeriodLabel(report)}`;
  sheet.getCell('A4').font = { size: 10, color: { argb: 'FF475569' } };
  sheet.getCell('E4').font = { size: 10, color: { argb: 'FF475569' } };

  if (logoBase64 && workbook) {
    const imageId = workbook.addImage({ base64: logoBase64, extension: 'png' });
    sheet.addImage(imageId, { tl: { col: 8, row: 0 }, ext: { width: 90, height: 54 } });
  }

  return 6;
};

export const buildExcelBuffer = async (report, title) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = COMPANY_NAME;
  workbook.created = new Date();
  const reportTitle = title || getReportTypeLabel(report);
  const logoBase64 = await getImageBase64(logoSrc);
  const sections = getReportSections(report);

  const sheet = workbook.addWorksheet('Report', {
    views: [{ state: 'frozen', ySplit: 6 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  let currentRow = addExcelReportHeader(sheet, reportTitle, report, logoBase64, workbook);

  if (!sections.length) {
    sheet.getCell(`A${currentRow}`).value = 'No data available for this report.';
    return workbook.xlsx.writeBuffer();
  }

  sections.forEach((section) => {
    currentRow += 1;
    sheet.mergeCells(`A${currentRow}:H${currentRow}`);
    const titleCell = sheet.getCell(`A${currentRow}`);
    titleCell.value = section.title;
    titleCell.font = { bold: true, size: 12, color: { argb: 'FF0F172A' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
    titleCell.alignment = { vertical: 'middle' };
    sheet.getRow(currentRow).height = 22;
    currentRow += 1;

    const headerRow = sheet.getRow(currentRow);
    section.headers.forEach((header, idx) => {
      headerRow.getCell(idx + 1).value = header;
    });
    styleExcelHeaderRow(headerRow);
    const headerRowNum = currentRow;
    currentRow += 1;

    const dataStart = currentRow;
    section.body.forEach((rowValues) => {
      const dataRow = sheet.getRow(currentRow);
      rowValues.forEach((val, idx) => {
        dataRow.getCell(idx + 1).value = val;
      });
      currentRow += 1;
    });

    const dataEnd = currentRow - 1;
    if (dataEnd >= dataStart) {
      styleExcelDataRows(sheet, dataStart, dataEnd, section.headers.length);
      autoSizeColumns(sheet, section.headers.length, headerRowNum, dataEnd);
    }
    currentRow += 1;
  });

  currentRow += 1;
  sheet.mergeCells(`A${currentRow}:H${currentRow}`);
  sheet.getCell(`A${currentRow}`).value = `Confidential — ${COMPANY_NAME} — ${new Date().getFullYear()}`;
  sheet.getCell(`A${currentRow}`).font = { size: 9, italic: true, color: { argb: 'FF94A3B8' } };

  return workbook.xlsx.writeBuffer();
};

export const downloadExcelReport = async (report, title, fileNameBase) => {
  const buffer = await buildExcelBuffer(report, title);
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileNameBase}-${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};

const addPdfBanner = (doc, title, report, logoBase64) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 72, 'F');

  if (logoBase64) {
    try {
      doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', 40, 12, 48, 48);
    } catch {
      /* logo optional */
    }
  }

  const textX = logoBase64 ? 100 : 40;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(COMPANY_NAME, textX, 28);
  doc.setFontSize(12);
  doc.text(title || getReportTypeLabel(report), textX, 46);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${REPORT_SUBTITLE}  •  Period: ${getPeriodLabel(report)}`, textX, 58);
  doc.text(`Generated: ${new Date().toLocaleString()}`, textX, 66);

  doc.setTextColor(30, 41, 59);
  return 84;
};

export const buildPdfDocument = async (report, title) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const reportTitle = title || getReportTypeLabel(report);
  const logoBase64 = await getImageBase64(logoSrc);
  const sections = getReportSections(report);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;

  let y = addPdfBanner(doc, reportTitle, report, logoBase64);

  if (!sections.length) {
    doc.setFontSize(11);
    doc.text('No data available for this report.', margin, y + 20);
    return doc;
  }

  sections.forEach((section, sectionIndex) => {
    if (y > pageHeight - 80) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(29, 78, 216);
    doc.text(section.title, margin, y);
    y += 14;

    autoTable(doc, {
      startY: y,
      head: [section.headers],
      body: section.body,
      theme: 'grid',
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8,
        cellPadding: 4,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [29, 78, 216],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didDrawPage: (data) => {
        const footerY = pageHeight - 18;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `${COMPANY_NAME} — Confidential`,
          margin,
          footerY
        );
        doc.text(
          `Page ${doc.internal.getNumberOfPages()}`,
          pageWidth - margin - 40,
          footerY
        );
      },
    });

    y = (doc.lastAutoTable?.finalY || y) + (sectionIndex < sections.length - 1 ? 22 : 10);
  });

  return doc;
};

export const downloadPdfReport = async (report, title, fileNameBase) => {
  const doc = await buildPdfDocument(report, title);
  doc.save(`${fileNameBase}-${new Date().toISOString().split('T')[0]}.pdf`);
};
