import { jsPDF } from 'jspdf';
import ExcelJS from 'exceljs';
import logoSrc from '../assets/IMG_1472.PNG';

const escapeCsv = (value) => {
  if (value == null) return '';
  const text = String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const normalizeReportRows = (report) => {
  if (!report) return [];
  if (Array.isArray(report.details)) return report.details;

  if (report.type === 'executive_summary') {
    return [
      { section: 'sales', ...report.sales },
      { section: 'production', ...report.production },
      { section: 'inventory', ...report.inventory },
      { section: 'procurement', ...report.procurement }
    ];
  }

  if (Array.isArray(report.revenue) || Array.isArray(report.costs)) {
    const rows = [];
    const maxLen = Math.max(report.revenue?.length || 0, report.costs?.length || 0);
    for (let i = 0; i < maxLen; i += 1) {
      rows.push({
        date: report.revenue?.[i]?.date || report.costs?.[i]?.date || '',
        revenue: report.revenue?.[i]?.revenue ?? '',
        cost: report.costs?.[i]?.cost ?? ''
      });
    }
    return rows;
  }

  return [];
};

export const reportToCsv = (report) => {
  const rows = normalizeReportRows(report);
  if (!rows.length) return 'No data available';

  const headerSet = new Set();
  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => headerSet.add(key));
  });
  const headers = Array.from(headerSet);

  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((h) => escapeCsv(row?.[h])).join(','));
  });
  return lines.join('\n');
};

export const downloadCsvReport = (report, fileNameBase) => {
  const csv = reportToCsv(report);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileNameBase}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const getImageBase64 = async (src) => {
  try {
    const response = await fetch(src);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result.split(',')[1]);
        } else {
          reject(new Error('Unable to convert image to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('Could not load logo for Excel export', e);
    return null;
  }
};

export const downloadExcelReport = async (report, title, fileNameBase) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Kinglion';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Report');
  sheet.properties.defaultRowHeight = 22;
  sheet.pageSetup.margins = { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75 };

  const logoBase64 = await getImageBase64(logoSrc);
  if (logoBase64) {
    const imageId = workbook.addImage({ base64: logoBase64, extension: 'png' });
    sheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 120, height: 60 } });
  }

  sheet.mergeCells('C1:H2');
  sheet.getCell('C1').value = title || 'Report';
  sheet.getCell('C1').alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getCell('C1').font = { size: 18, bold: true, color: { argb: 'FF175CD3' } };

  sheet.getCell('C3').value = `Generated: ${new Date().toLocaleString()}`;
  sheet.getCell('C3').font = { italic: true, size: 10, color: { argb: 'FF4B5563' } };

  let currentRow = 5;
  if (report?.summary && Object.keys(report.summary).length > 0) {
    sheet.getCell(`A${currentRow}`).value = 'Summary';
    sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
    sheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } };
    currentRow += 1;

    Object.entries(report.summary).forEach(([key, value]) => {
      sheet.getCell(`A${currentRow}`).value = key.replace(/_/g, ' ');
      sheet.getCell(`A${currentRow}`).font = { bold: true };
      sheet.getCell(`B${currentRow}`).value = typeof value === 'number' ? value : String(value);
      currentRow += 1;
    });
    currentRow += 1;
  }

  const rows = normalizeReportRows(report);
  if (rows.length > 0) {
    const headers = Object.keys(rows[0] || {});
    const headerRow = sheet.getRow(currentRow);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header.replace(/_/g, ' ');
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    headerRow.height = 24;
    currentRow += 1;

    rows.forEach((row) => {
      const dataRow = sheet.addRow(headers.map((header) => row[header] ?? ''));
      dataRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.alignment = { vertical: 'middle', horizontal: typeof cell.value === 'number' ? 'right' : 'left' };
      });
    });

    sheet.columns.forEach((column) => {
      column.width = Math.max(14, (column.header?.toString().length || 10) + 4);
    });

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > currentRow && rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        });
      }
    });
  } else {
    sheet.getCell(`A${currentRow}`).value = 'No data available';
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileNameBase}-${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadPdfReport = (report, title, fileNameBase) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 48;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, margin, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
  y += 20;

  const summary = report?.summary || null;
  if (summary && Object.keys(summary).length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Summary', margin, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    Object.entries(summary).forEach(([key, value]) => {
      if (y > 780) {
        doc.addPage();
        y = 40;
      }
      doc.text(`${key}: ${value ?? ''}`, margin, y);
      y += 14;
    });
    y += 8;
  }

  const rows = normalizeReportRows(report);
  if (rows.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    if (y > 760) {
      doc.addPage();
      y = 40;
    }
    doc.text('Details', margin, y);
    y += 14;

    const headers = Object.keys(rows[0] || {});
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(headers.join(' | ').slice(0, 140), margin, y);
    y += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    rows.slice(0, 80).forEach((row) => {
      if (y > 790) {
        doc.addPage();
        y = 40;
      }
      const line = headers.map((h) => row?.[h] ?? '').join(' | ');
      const chunks = doc.splitTextToSize(line, pageWidth - margin * 2);
      doc.text(chunks.slice(0, 2), margin, y);
      y += 12 + (chunks.length > 1 ? 10 : 0);
    });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('No detailed rows available for this report.', margin, y);
  }

  doc.save(`${fileNameBase}-${new Date().toISOString().split('T')[0]}.pdf`);
};
