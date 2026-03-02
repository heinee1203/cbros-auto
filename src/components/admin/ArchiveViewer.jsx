import { useState, useMemo } from 'react';
import {
  Download, Printer, Search, Clock, Ban, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { parse } from 'date-fns';
import { useJobsStore } from '../../stores/jobsStore';
import { useAdminStore, getMechanicDisplay } from '../../stores/adminStore';
import { STATUS_LABELS } from '../../data/rosters';

export default function ArchiveViewer() {
  const archivedJobs = useJobsStore((s) => s.archivedJobs);
  const mechanics = useAdminStore((s) => s.mechanics);

  // Filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [plateSearch, setPlateSearch] = useState('');
  const [expandedDates, setExpandedDates] = useState({});

  // Group and filter archived jobs by date
  const groupedArchive = useMemo(() => {
    const groups = {};
    archivedJobs.forEach((j) => {
      if (!j.archivedAt) return;
      const datePart = j.archivedAt.split(' at ')[0]; // "MM/dd/yyyy"
      if (!groups[datePart]) groups[datePart] = [];
      groups[datePart].push(j);
    });

    let entries = Object.entries(groups);

    // Filter by date range
    if (dateFrom) {
      const from = new Date(dateFrom + 'T00:00:00');
      entries = entries.filter(([dateStr]) => {
        const d = parse(dateStr, 'MM/dd/yyyy', new Date());
        return d >= from;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59');
      entries = entries.filter(([dateStr]) => {
        const d = parse(dateStr, 'MM/dd/yyyy', new Date());
        return d <= to;
      });
    }

    // Filter by plate search
    if (plateSearch.trim()) {
      const q = plateSearch.trim().toLowerCase();
      entries = entries
        .map(([date, jobs]) => [
          date,
          jobs.filter((j) => (j.plateNumber || '').toLowerCase().includes(q)),
        ])
        .filter(([, jobs]) => jobs.length > 0);
    }

    // Sort by date descending (most recent first)
    entries.sort((a, b) => {
      const da = parse(a[0], 'MM/dd/yyyy', new Date());
      const db = parse(b[0], 'MM/dd/yyyy', new Date());
      return db - da;
    });

    return entries;
  }, [archivedJobs, dateFrom, dateTo, plateSearch]);

  const totalFiltered = groupedArchive.reduce((sum, [, jobs]) => sum + jobs.length, 0);

  // ── Export CSV for a date group ───────────────────────────────────────────
  const exportArchiveCSV = (date, jobs) => {
    const rows = [];
    rows.push(
      [
        'Queue #', 'Status', 'Customer', 'Phone', 'Year', 'Make', 'Model',
        'Plate', 'VIN', 'Mechanic', 'Reason for Visit', 'Service Started',
        'Completed', 'Archived At',
      ].join(',')
    );

    jobs.forEach((j) => {
      const escape = (val) => {
        const str = String(val || '');
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      };
      const rfv = Array.isArray(j.reasonForVisit)
        ? j.reasonForVisit.join('; ')
        : j.reasonForVisit || '';
      const completed = j.isCanceled
        ? `Cancelled at ${j.canceledAt || ''}`
        : j.paidAt || j.doneAt || '';
      rows.push(
        [
          escape(j.queueNumber),
          escape(j.isCanceled ? 'Cancelled' : (STATUS_LABELS[j.status] || j.status)),
          escape(j.customerName),
          escape(j.phoneNumber),
          escape(j.year),
          escape(j.make),
          escape(j.model),
          escape(j.plateNumber),
          escape(j.vin),
          escape(j.assignedMechanic),
          escape(rfv),
          escape(j.serviceStartedAt),
          escape(completed),
          escape(j.archivedAt),
        ].join(',')
      );
    });

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CBROS_Archive_${date.replace(/\//g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Export PDF for a date group ───────────────────────────────────────────
  const exportArchivePDF = (date, jobs) => {
    const cancelledCount = jobs.filter((j) => j.isCanceled).length;
    const completedCount = jobs.length - cancelledCount;

    const jobRows = jobs
      .map((j) => {
        const completed = j.isCanceled
          ? `<span style="color:#ef4444">Cancelled ${j.canceledAt || ''}</span>`
          : j.paidAt || j.doneAt || '-';
        const statusColor = j.isCanceled ? '#ef4444' : '#0d9488';
        const statusText = j.isCanceled ? 'Cancelled' : (STATUS_LABELS[j.status] || j.status);
        return `<tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:6px 8px;font-family:monospace;font-weight:700;color:#2563eb">${j.queueNumber || '-'}</td>
          <td style="padding:6px 8px"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;color:white;background:${statusColor}">${statusText}</span></td>
          <td style="padding:6px 8px;font-weight:600">${j.year} ${j.make} ${j.model}</td>
          <td style="padding:6px 8px;font-family:monospace">${j.plateNumber || '-'}</td>
          <td style="padding:6px 8px">${j.customerName}</td>
          <td style="padding:6px 8px">${j.assignedMechanic ? getMechanicDisplay(j.assignedMechanic, mechanics) : '-'}</td>
          <td style="padding:6px 8px">${j.serviceStartedAt || '-'}</td>
          <td style="padding:6px 8px">${completed}</td>
        </tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html><head>
  <title>CBROS Archive - ${date}</title>
  <style>
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; margin: 0; padding: 24px; font-size: 12px; }
    .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-size: 20px; font-weight: 800; color: #1e3a5f; margin: 0; letter-spacing: 2px; text-transform: uppercase; }
    .header p { color: #6b7280; margin: 4px 0 0; font-size: 12px; }
    .stats { display: flex; gap: 12px; margin-bottom: 20px; }
    .stat-card { flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; text-align: center; }
    .stat-card .value { font-size: 24px; font-weight: 800; }
    .stat-card .label { font-size: 10px; color: #6b7280; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; padding: 8px; font-weight: 600; color: #6b7280; border-bottom: 2px solid #d1d5db; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 6px 8px; vertical-align: top; }
    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
  </style>
</head><body>
  <div class="header">
    <h1>CBROS Auto Service Division</h1>
    <p>Archived Jobs &mdash; ${date}</p>
  </div>

  <div class="stats">
    <div class="stat-card"><div class="value" style="color:#2563eb">${jobs.length}</div><div class="label">Total Archived</div></div>
    <div class="stat-card"><div class="value" style="color:#0d9488">${completedCount}</div><div class="label">Completed</div></div>
    <div class="stat-card"><div class="value" style="color:#ef4444">${cancelledCount}</div><div class="label">Cancelled</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Queue #</th><th>Status</th><th>Vehicle</th><th>Plate</th><th>Customer</th><th>Mechanic</th><th>Service Started</th><th>Completed</th>
      </tr>
    </thead>
    <tbody>${jobRows}</tbody>
  </table>

  <div class="footer">
    CBROS Auto Service Division &mdash; Archive Report &mdash; ${date}
  </div>
</body></html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  const toggleDate = (date) => {
    setExpandedDates((prev) => ({
      ...prev,
      [date]: prev[date] === false ? true : false,
    }));
  };

  const inputCls =
    'w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-gray-500" />
          Search Archived Reports
        </h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Plate # Search
            </label>
            <input
              value={plateSearch}
              onChange={(e) => setPlateSearch(e.target.value)}
              placeholder="e.g. ABC 1234"
              className={inputCls}
            />
          </div>
          {(dateFrom || dateTo || plateSearch) && (
            <button
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setPlateSearch('');
              }}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Showing {totalFiltered} archived job{totalFiltered !== 1 ? 's' : ''} across{' '}
          {groupedArchive.length} date{groupedArchive.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Empty state */}
      {groupedArchive.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-10 text-center">
          <Clock className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {archivedJobs.length === 0
              ? 'No archived jobs yet.'
              : 'No results match your filters.'}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {archivedJobs.length === 0
              ? 'Jobs are archived when you run "Close Out Day" from the EOD Report.'
              : 'Try adjusting your date range or plate # search.'}
          </p>
        </div>
      )}

      {/* Grouped results */}
      {groupedArchive.map(([date, jobs]) => {
        const isExpanded = expandedDates[date] !== false; // default expanded
        const cancelledCount = jobs.filter((j) => j.isCanceled).length;

        return (
          <div
            key={date}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
          >
            {/* Date header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center gap-2">
              <button
                onClick={() => toggleDate(date)}
                className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400"
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-bold text-gray-900 dark:text-white">{date}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {jobs.length} job{jobs.length !== 1 ? 's' : ''}
                {cancelledCount > 0 && (
                  <span className="text-red-500 ml-1">({cancelledCount} cancelled)</span>
                )}
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={() => exportArchivePDF(date, jobs)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  PDF
                </button>
                <button
                  onClick={() => exportArchiveCSV(date, jobs)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </button>
              </div>
            </div>

            {/* Job table */}
            {isExpanded && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">
                        Queue #
                      </th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">
                        Status
                      </th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">
                        Vehicle
                      </th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">
                        Plate #
                      </th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">
                        Customer
                      </th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">
                        Mechanic
                      </th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">
                        Service Started
                      </th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">
                        Completed
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => (
                      <tr
                        key={j.id}
                        className={`border-b border-gray-100 dark:border-gray-800 ${
                          j.isCanceled
                            ? 'bg-red-50/50 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                      >
                        <td className="py-2 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {j.queueNumber || '-'}
                        </td>
                        <td className="py-2 px-3">
                          {j.isCanceled ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-bold text-[10px]">
                              <Ban className="w-2.5 h-2.5" />
                              Cancelled
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 font-medium text-[10px]">
                              {STATUS_LABELS[j.status] || j.status}
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-2 px-3 font-medium ${
                            j.isCanceled
                              ? 'text-red-700 dark:text-red-300 line-through'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {j.year} {j.make} {j.model}
                        </td>
                        <td className="py-2 px-3 text-gray-600 dark:text-gray-400 font-mono text-[11px]">
                          {j.plateNumber || '-'}
                        </td>
                        <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                          {j.customerName}
                        </td>
                        <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                          {j.assignedMechanic
                            ? getMechanicDisplay(j.assignedMechanic, mechanics)
                            : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                          {j.serviceStartedAt || (
                            <span className="text-gray-300 dark:text-gray-600">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {j.isCanceled ? (
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              {j.canceledAt || '-'}
                            </span>
                          ) : (
                            <span className="text-teal-600 dark:text-teal-400 font-medium">
                              {j.paidAt || j.doneAt || '-'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
