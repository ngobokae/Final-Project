import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import logoSrc from '../assets/IMG_1472.PNG';

const COMPANY_NAME = 'Kinglion Rwanda Investment Ltd';
const REPORT_SUBTITLE = 'Manufacturing & Supply Chain Intelligence';
const CSV_LINE_WIDTH = 78;

/** Kinglion system brand palette (matches sidebar: neutral-950 + red-600/800) */
const BRAND = {
  dark: { rgb: [10, 10, 10], argb: 'FF0A0A0A' },
  darkMid: { rgb: [38, 38, 38], argb: 'FF262626' },
  red: { rgb: [220, 38, 38], argb: 'FFDC2626' },
  redDark: { rgb: [153, 27, 27], argb: 'FF991B1B' },
  redLight: { argb: 'FFFEF2F2' },
  redSection: { argb: 'FFFEE2E2' },
  muted: { rgb: [100, 116, 139], argb: 'FF64748B' },
  border: { rgb: [229, 231, 235], argb: 'FFE5E7EB' },
  white: { argb: 'FFFFFFFF' },
};

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

const centerText = (text, width = CSV_LINE_WIDTH) => {
  const t = String(text).trim();
  if (t.length >= width) return t;
  const pad = Math.floor((width - t.length) / 2);
  return `${' '.repeat(pad)}${t}`;
};

const formatExportDate = () =>
  new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatRoleLabel = (role) => {
  const map = {
    admin: 'Administrator',
    executive: 'Executive Manager',
    inventory: 'Inventory Manager',
    inventory_manager: 'Inventory Manager',
    operations: 'Operations Manager',
  };
  if (!role) return 'Staff';
  return map[role] || String(role).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const getExportMeta = () => {
  if (typeof window === 'undefined') {
    return {
      email: 'system@kinglion.rw',
      preparedRole: 'Administrator',
      approvedRole: 'Manager',
    };
  }
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return {
      email: user.email || 'N/A',
      preparedRole: formatRoleLabel(user.role),
      approvedRole: 'Manager',
    };
  } catch {
    return { email: 'N/A', preparedRole: 'Staff', approvedRole: 'Manager' };
  }
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

const buildCsvSignatureBlock = (meta) => {
  const generated = formatExportDate();
  const colWidth = 36;
  const padSide = (left, right) => {
    const gap = Math.max(1, CSV_LINE_WIDTH - left.length - right.length);
    return `${left}${' '.repeat(gap)}${right}`;
  };
  const lines = [
    '',
    centerText('─'.repeat(60)),
    padSide(centerText('PREPARED BY', colWidth).trim(), centerText('APPROVED BY', colWidth).trim()),
    '',
    padSide('Signature: ____________________', 'Signature: ____________________'),
    padSide(meta.preparedRole, meta.approvedRole),
    padSide('Date: __________________', 'Date: __________________'),
    '',
    centerText('─'.repeat(60)),
    centerText(`Generated on: ${generated}`),
    centerText(`Generated by: ${meta.email}`),
    centerText(`© ${new Date().getFullYear()} ${COMPANY_NAME}. Confidential.`),
  ];
  return lines;
};

export const buildCsvContent = (report, title) => {
  const reportTitle = title || getReportTypeLabel(report);
  const period = getPeriodLabel(report);
  const meta = getExportMeta();
  const sections = getReportSections(report);
  const lines = [];

  lines.push(centerText(COMPANY_NAME.toUpperCase()));
  lines.push(centerText(reportTitle.toUpperCase()));
  lines.push(centerText(REPORT_SUBTITLE));
  lines.push('');
  lines.push(centerText(`Generated: ${formatExportDate()}`));
  lines.push(centerText(`Reporting Period: ${period}`));
  lines.push(centerText(`Report Type: ${report?.type || 'general'}`));
  lines.push('');
  lines.push(centerText('═'.repeat(60)));

  if (!sections.length) {
    lines.push('');
    lines.push(centerText('No data available for this report.'));
    lines.push(...buildCsvSignatureBlock(meta));
    return lines.join('\n');
  }

  sections.forEach((section, index) => {
    if (index > 0) lines.push('');
    lines.push('');
    lines.push(centerText(section.title.toUpperCase()));
    lines.push(centerText('─'.repeat(Math.min(section.title.length + 8, CSV_LINE_WIDTH))));
    lines.push(section.headers.map(escapeCsv).join(','));
    section.body.forEach((row) => {
      lines.push(row.map(escapeCsv).join(','));
    });
  });

  lines.push(...buildCsvSignatureBlock(meta));
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
  row.height = 26;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: BRAND.white.argb }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.red.argb } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: BRAND.redDark.argb } },
      left: { style: 'thin', color: { argb: BRAND.redDark.argb } },
      bottom: { style: 'thin', color: { argb: BRAND.redDark.argb } },
      right: { style: 'thin', color: { argb: BRAND.redDark.argb } },
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
        top: { style: 'thin', color: { argb: BRAND.border.argb } },
        left: { style: 'thin', color: { argb: BRAND.border.argb } },
        bottom: { style: 'thin', color: { argb: BRAND.border.argb } },
        right: { style: 'thin', color: { argb: BRAND.border.argb } },
      };
      cell.alignment = { vertical: 'middle', wrapText: true };
      if (isAlt) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.redLight.argb } };
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

const styleExcelCenterTitle = (cell, size, colorArgb, bold = true) => {
  cell.font = { size, bold, color: { argb: colorArgb } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
};

const addExcelReportHeader = (sheet, title, report, logoBase64, workbook) => {
  const mergeEnd = 'J';

  sheet.mergeCells(`A1:${mergeEnd}1`);
  sheet.getRow(1).height = 28;
  styleExcelCenterTitle(sheet.getCell('A1'), 18, BRAND.dark.argb);
  sheet.getCell('A1').value = COMPANY_NAME;

  sheet.mergeCells(`A2:${mergeEnd}2`);
  sheet.getRow(2).height = 24;
  styleExcelCenterTitle(sheet.getCell('A2'), 14, BRAND.red.argb);
  sheet.getCell('A2').value = title || getReportTypeLabel(report);

  sheet.mergeCells(`A3:${mergeEnd}3`);
  sheet.getRow(3).height = 20;
  styleExcelCenterTitle(sheet.getCell('A3'), 10, BRAND.muted.argb, false);
  sheet.getCell('A3').value = REPORT_SUBTITLE;
  sheet.getCell('A3').font = { ...sheet.getCell('A3').font, italic: true };

  sheet.mergeCells(`A4:${mergeEnd}4`);
  sheet.getRow(4).height = 18;
  styleExcelCenterTitle(sheet.getCell('A4'), 10, BRAND.muted.argb, false);
  sheet.getCell('A4').value = `Generated: ${formatExportDate()}  •  Period: ${getPeriodLabel(report)}`;

  sheet.mergeCells(`A5:${mergeEnd}5`);
  sheet.getRow(5).height = 14;
  const divider = sheet.getCell('A5');
  divider.value = '';
  divider.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.red.argb } };

  if (logoBase64 && workbook) {
    const imageId = workbook.addImage({ base64: logoBase64, extension: 'png' });
    sheet.addImage(imageId, { tl: { col: 0.2, row: 0.1 }, ext: { width: 72, height: 54 } });
  }

  return 7;
};

const addExcelSignatureBlock = (sheet, startRow, meta) => {
  let row = startRow + 1;
  const leftEnd = 'E';
  const rightStart = 'F';
  const rightEnd = 'J';

  const drawSignBox = (startCol, endCol, label, role) => {
    const topRow = row;
    sheet.mergeCells(`${startCol}${topRow}:${endCol}${topRow}`);
    const headerCell = sheet.getCell(`${startCol}${topRow}`);
    headerCell.value = label;
    headerCell.font = { bold: true, size: 11, color: { argb: BRAND.red.argb } };
    headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
    headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.redSection.argb } };
    sheet.getRow(topRow).height = 22;

    const sigRow = topRow + 2;
    sheet.mergeCells(`${startCol}${sigRow}:${endCol}${sigRow}`);
    sheet.getCell(`${startCol}${sigRow}`).value = 'Signature';
    sheet.getCell(`${startCol}${sigRow}`).font = { size: 9, color: { argb: BRAND.muted.argb } };
    sheet.getCell(`${startCol}${sigRow}`).alignment = { horizontal: 'center' };

    const lineRow = topRow + 3;
    sheet.mergeCells(`${startCol}${lineRow}:${endCol}${lineRow}`);
    sheet.getCell(`${startCol}${lineRow}`).border = {
      bottom: { style: 'thin', color: { argb: BRAND.muted.argb } },
    };

    const roleRow = topRow + 4;
    sheet.mergeCells(`${startCol}${roleRow}:${endCol}${roleRow}`);
    const roleCell = sheet.getCell(`${startCol}${roleRow}`);
    roleCell.value = role;
    roleCell.font = { bold: true, size: 10 };
    roleCell.alignment = { horizontal: 'center' };

    const dateRow = topRow + 6;
    sheet.mergeCells(`${startCol}${dateRow}:${endCol}${dateRow}`);
    sheet.getCell(`${startCol}${dateRow}`).value = 'Date: __________________';
    sheet.getCell(`${startCol}${dateRow}`).font = { size: 10 };
    sheet.getCell(`${startCol}${dateRow}`).alignment = { horizontal: 'left' };

    for (let r = topRow; r <= topRow + 6; r += 1) {
      for (const col of [startCol, endCol]) {
        const cell = sheet.getCell(`${col}${r}`);
        cell.border = {
          ...cell.border,
          top: r === topRow ? { style: 'thin', color: { argb: BRAND.border.argb } } : cell.border?.top,
          bottom: r === topRow + 6 ? { style: 'thin', color: { argb: BRAND.border.argb } } : cell.border?.bottom,
          left: col === startCol ? { style: 'thin', color: { argb: BRAND.border.argb } } : cell.border?.left,
          right: col === endCol ? { style: 'thin', color: { argb: BRAND.border.argb } } : cell.border?.right,
        };
      }
    }
  };

  drawSignBox('A', leftEnd, 'PREPARED BY', meta.preparedRole);
  drawSignBox(rightStart, rightEnd, 'APPROVED BY', meta.approvedRole);

  row += 9;
  sheet.mergeCells(`A${row}:J${row}`);
  const footer = sheet.getCell(`A${row}`);
  footer.value = `Generated on: ${formatExportDate()}  •  Generated by: ${meta.email}  •  © ${new Date().getFullYear()} ${COMPANY_NAME}. Confidential.`;
  footer.font = { size: 9, italic: true, color: { argb: BRAND.muted.argb } };
  footer.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  sheet.getRow(row).height = 28;

  return row + 1;
};

export const buildExcelBuffer = async (report, title) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = COMPANY_NAME;
  workbook.created = new Date();
  const reportTitle = title || getReportTypeLabel(report);
  const logoBase64 = await getImageBase64(logoSrc);
  const meta = getExportMeta();
  const sections = getReportSections(report);

  const sheet = workbook.addWorksheet('Report', {
    views: [{ state: 'frozen', ySplit: 7 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  let currentRow = addExcelReportHeader(sheet, reportTitle, report, logoBase64, workbook);

  if (!sections.length) {
    sheet.mergeCells(`A${currentRow}:J${currentRow}`);
    sheet.getCell(`A${currentRow}`).value = 'No data available for this report.';
    sheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
    addExcelSignatureBlock(sheet, currentRow + 1, meta);
    return workbook.xlsx.writeBuffer();
  }

  sections.forEach((section) => {
    currentRow += 1;
    sheet.mergeCells(`A${currentRow}:J${currentRow}`);
    const titleCell = sheet.getCell(`A${currentRow}`);
    titleCell.value = section.title;
    titleCell.font = { bold: true, size: 12, color: { argb: BRAND.redDark.argb } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.redSection.argb } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(currentRow).height = 24;
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

  addExcelSignatureBlock(sheet, currentRow, meta);
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
  const bannerHeight = 98;

  doc.setFillColor(...BRAND.dark.rgb);
  doc.rect(0, 0, pageWidth, bannerHeight - 6, 'F');
  doc.setFillColor(...BRAND.redDark.rgb);
  doc.rect(0, bannerHeight - 6, pageWidth, 6, 'F');

  if (logoBase64) {
    try {
      doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', 44, 18, 52, 52);
    } catch {
      /* logo optional */
    }
  }

  const textX = logoBase64 ? 112 : 44;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(COMPANY_NAME, textX, 36);
  doc.setFontSize(12);
  doc.text(title || getReportTypeLabel(report), textX, 56);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${REPORT_SUBTITLE}  •  Period: ${getPeriodLabel(report)}`, textX, 72);
  doc.text(`Generated: ${formatExportDate()}`, textX, 84);

  doc.setTextColor(30, 41, 59);
  return bannerHeight + 12;
};

const addPdfSignatureBlock = (doc, y, meta) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const boxWidth = (pageWidth - margin * 2 - 20) / 2;
  const boxHeight = 88;

  if (y + boxHeight + 60 > pageHeight) {
    doc.addPage();
    y = margin;
  }

  const drawBox = (x, label, role) => {
    doc.setDrawColor(...BRAND.border.rgb);
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(x, y, boxWidth, boxHeight, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.red.rgb);
    doc.text(label, x + boxWidth / 2, y + 16, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted.rgb);
    doc.text('Signature', x + boxWidth / 2, y + 38, { align: 'center' });

    doc.setDrawColor(...BRAND.muted.rgb);
    doc.line(x + 24, y + 48, x + boxWidth - 24, y + 48);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(role, x + boxWidth / 2, y + 62, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Date: __________________', x + 16, y + 78);
  };

  drawBox(margin, 'PREPARED BY', meta.preparedRole);
  drawBox(margin + boxWidth + 20, 'APPROVED BY', meta.approvedRole);

  y += boxHeight + 18;
  doc.setDrawColor(...BRAND.border.rgb);
  doc.line(margin, y, pageWidth - margin, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted.rgb);
  const footerText = `Generated on: ${formatExportDate()}  •  Generated by: ${meta.email}  •  © ${new Date().getFullYear()} ${COMPANY_NAME}. Confidential.`;
  doc.text(footerText, pageWidth / 2, y, { align: 'center' });

  return y + 10;
};

export const buildPdfDocument = async (report, title) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const reportTitle = title || getReportTypeLabel(report);
  const logoBase64 = await getImageBase64(logoSrc);
  const meta = getExportMeta();
  const sections = getReportSections(report);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;

  let y = addPdfBanner(doc, reportTitle, report, logoBase64);

  if (!sections.length) {
    doc.setFontSize(11);
    doc.text('No data available for this report.', pageWidth / 2, y + 20, { align: 'center' });
    addPdfSignatureBlock(doc, y + 40, meta);
    return doc;
  }

  sections.forEach((section, sectionIndex) => {
    if (y > pageHeight - 120) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BRAND.red.rgb);
    doc.text(section.title, pageWidth / 2, y, { align: 'center' });
    y += 16;

    autoTable(doc, {
      startY: y,
      head: [section.headers],
      body: section.body,
      theme: 'grid',
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8,
        cellPadding: 5,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: BRAND.red.rgb,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      didDrawPage: () => {
        const footerY = pageHeight - 18;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...BRAND.muted.rgb);
        doc.text(`${COMPANY_NAME} — Confidential`, margin, footerY);
        doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - margin - 40, footerY);
      },
    });

    y = (doc.lastAutoTable?.finalY || y) + (sectionIndex < sections.length - 1 ? 24 : 12);
  });

  addPdfSignatureBlock(doc, y + 8, meta);
  return doc;
};

export const downloadPdfReport = async (report, title, fileNameBase) => {
  const doc = await buildPdfDocument(report, title);
  doc.save(`${fileNameBase}-${new Date().toISOString().split('T')[0]}.pdf`);
};
