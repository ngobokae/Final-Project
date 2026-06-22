export const validateReportDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return 'Please select both a start date and end date before generating or downloading a report.';
  }
  if (startDate > endDate) {
    return 'Start date must be on or before end date.';
  }
  return null;
};

export const buildReportQueryString = (startDate, endDate) =>
  `start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;

export const formatReportDateRangeLabel = (startDate, endDate) =>
  startDate && endDate ? `${startDate} to ${endDate}` : '';
