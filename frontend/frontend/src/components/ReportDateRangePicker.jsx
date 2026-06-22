export default function ReportDateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  accentClass = 'focus:ring-emerald-500',
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className={`w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 ${accentClass} focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100`}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className={`w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 ${accentClass} focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100`}
        />
      </div>
    </>
  );
}
