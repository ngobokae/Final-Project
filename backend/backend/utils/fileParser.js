import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';

/**
 * Parse uploaded file (CSV or XLSX) and return structured data
 * @param {Buffer} fileBuffer - File content
 * @param {string} fileName - Original file name
 * @returns {Object} { columns, rows, format }
 */
export const parseUploadedFile = (fileBuffer, fileName) => {
  const ext = fileName.toLowerCase().split('.').pop();
  
  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcelFile(fileBuffer, fileName);
  } else if (ext === 'csv') {
    return parseCsvFile(fileBuffer, fileName);
  } else {
    throw new Error('Unsupported file format. Please use CSV or Excel (.xlsx, .xls)');
  }
};

/**
 * Parse CSV file
 */
const parseCsvFile = (fileBuffer, fileName) => {
  try {
    const content = fileBuffer.toString('utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true
    });

    if (!records || records.length === 0) {
      throw new Error('CSV file is empty');
    }

    const columns = Object.keys(records[0]);
    const rows = records.map(record => ({
      ...record,
      _raw: record
    }));

    return {
      format: 'csv',
      fileName,
      columns,
      rows,
      rowCount: rows.length,
      columnCount: columns.length
    };
  } catch (error) {
    throw new Error(`CSV parsing error: ${error.message}`);
  }
};

/**
 * Parse Excel file (XLSX)
 */
const parseExcelFile = (fileBuffer, fileName) => {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const firstSheet = workbook.SheetNames[0];
    
    if (!firstSheet) {
      throw new Error('Excel file has no sheets');
    }

    const worksheet = workbook.Sheets[firstSheet];
    const records = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: ''
    });

    if (!records || records.length < 2) {
      throw new Error('Excel file is empty or has no headers');
    }

    const columns = records[0];
    const rows = records.slice(1).map(row => {
      const obj = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx] || '';
      });
      return obj;
    });

    return {
      format: 'xlsx',
      fileName,
      columns,
      rows,
      rowCount: rows.length,
      columnCount: columns.length
    };
  } catch (error) {
    throw new Error(`Excel parsing error: ${error.message}`);
  }
};

/**
 * Validate if file has expected inventory data structure
 * Required columns: product_id/sku/product_name + date + quantity + other optional fields
 */
export const validateInventoryFileStructure = (columns) => {
  const productIdentifiers = columns.filter(c => 
    c.toLowerCase().match(/product_id|sku|product_name|product|item_id/)
  );
  
  const dateColumns = columns.filter(c =>
    c.toLowerCase().match(/date|sale_date|transaction_date|created_at/)
  );

  const quantityColumns = columns.filter(c =>
    c.toLowerCase().match(/quantity|qty|units|sold|in_stock|current|demand|sold_in_range|sold_30d/)
  );

  const hasProductId = productIdentifiers.length > 0;
  const hasDate = dateColumns.length > 0;
  const hasQuantity = quantityColumns.length > 0;

  if (!hasProductId || !hasQuantity) {
    const missing = [];
    if (!hasProductId) missing.push('product identifier (product_id, sku, or product_name)');
    if (!hasQuantity) missing.push('quantity/demand column');
    throw new Error(`Missing required columns: ${missing.join(', ')}`);
  }

  return {
    valid: true,
    productColumn: productIdentifiers[0],
    dateColumn: dateColumns[0] || null,
    quantityColumn: quantityColumns[0],
    allColumns: {
      products: productIdentifiers,
      dates: dateColumns,
      quantities: quantityColumns
    }
  };
};

/**
 * Parse date from various formats
 */
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  
  dateStr = String(dateStr).trim();
  
  // Try DD/MM/YYYY format (24/05/2026)
  if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    const [day, month, year] = dateStr.split('/');
    const date = new Date(year, parseInt(month) - 1, day);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  // Try MM/DD/YYYY format
  if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    const [month, day, year] = dateStr.split('/');
    const date = new Date(year, parseInt(month) - 1, day);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  // Try ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.toISOString().split('T')[0];
  }
  
  return null;
};

/**
 * Transform parsed file data to forecast-ready format
 */
export const transformToForecastData = (rows, validation) => {
  const productCol = validation.productColumn;
  const dateCol = validation.dateColumn;
  const quantityCol = validation.quantityColumn;

  return rows
    .filter(row => row[productCol] && row[quantityCol])
    .map(row => ({
      product_identifier: String(row[productCol]).trim(),
      date: dateCol ? parseDate(row[dateCol]) : null,
      quantity: Number(row[quantityCol]) || 0,
      raw_data: row
    }))
    .filter(item => !isNaN(item.quantity) && item.quantity >= 0);
};
