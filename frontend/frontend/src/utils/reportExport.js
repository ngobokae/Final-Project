import { jsPDF } from 'jspdf';

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
