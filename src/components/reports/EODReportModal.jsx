import { useMemo } from 'react';
import { X, Download, FileText, Car, Wrench, Clock, CheckCircle2, Settings, Package, ClipboardList, BadgeCheck, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { useUIStore } from '../../stores/uiStore';
import { useJobsStore, to12Hour } from '../../stores/jobsStore';
import { JOB_STATUSES, STATUS_LABELS } from '../../data/rosters';
import { useAdminStore } from '../../stores/adminStore';

export default function EODReportModal() {
  const { eodModalOpen, closeEodModal } = useUIStore();
  const jobs = useJobsStore((s) => s.jobs);
  const mechanics = useAdminStore((s) => s.mechanics);

  const today = format(new Date(), 'MM/dd/yyyy');
  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const nowTime = format(new Date(), 'hh:mm a');

  const report = useMemo(() => {
    const allJobs = jobs;

    // Jobs by status
    const waitlist = allJobs.filter((j) => j.status === JOB_STATUSES.WAITLIST);
    const inService = allJobs.filter((j) => j.status === JOB_STATUSES.IN_SERVICE);
    const awaitingParts = allJobs.filter((j) => j.status === JOB_STATUSES.AWAITING_PARTS);
    const readyForPickup = allJobs.filter((j) => j.status === JOB_STATUSES.READY_FOR_PICKUP);
    const done = allJobs.filter((j) => j.status === JOB_STATUSES.DONE);

    // Ongoing jobs — Waitlist, In-Service, Awaiting Parts carry over to next day
    const ongoingJobs = allJobs.filter(
      (j) =>
        j.status === JOB_STATUSES.WAITLIST ||
        j.status === JOB_STATUSES.IN_SERVICE ||
        j.status === JOB_STATUSES.AWAITING_PARTS
    );

    // Jobs received today
    const receivedToday = allJobs.filter((j) => j.dateReceived === today);

    // Jobs with appointments today
    const appointmentsToday = allJobs.filter((j) => j.appointmentDate === today);

    // Jobs with parts ordered
    const partsOrderedJobs = allJobs.filter((j) => j.partsOrdered);

    // Unassigned jobs
    const unassignedJobs = allJobs.filter((j) => !j.assignedMechanic);

    // Total man-hours: sum estimated hours from ALL active jobs (not just today's appointments)
    const totalManHours = allJobs
      .filter((j) => j.estimatedManHours)
      .reduce((sum, j) => sum + j.estimatedManHours, 0);

    // Today's appointment man-hours
    const todayManHours = appointmentsToday
      .filter((j) => j.estimatedManHours)
      .reduce((sum, j) => sum + j.estimatedManHours, 0);

    // Mechanic workloads across ALL active jobs
    const mechanicLoads = {};
    allJobs.forEach((j) => {
      if (j.estimatedManHours) {
        const hours = j.estimatedManHours || 0;
        if (j.assignedMechanic) {
          if (!mechanicLoads[j.assignedMechanic]) mechanicLoads[j.assignedMechanic] = { hours: 0, jobs: 0 };
          mechanicLoads[j.assignedMechanic].hours += hours;
          mechanicLoads[j.assignedMechanic].jobs += 1;
        }
        if (j.assistantMechanic) {
          if (!mechanicLoads[j.assistantMechanic]) mechanicLoads[j.assistantMechanic] = { hours: 0, jobs: 0 };
          mechanicLoads[j.assistantMechanic].hours += hours;
          mechanicLoads[j.assistantMechanic].jobs += 1;
        }
      }
    });

    // Completed Jobs — all jobs in DONE column, sorted by intake time (FIFO)
    // Uses createdAt (ISO string) for reliable chronological sorting
    const completedToday = [...done]
      .filter((j) => j.createdAt) // ensure intakeTime field exists for sort
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return {
      total: allJobs.length,
      waitlist,
      inService,
      awaitingParts,
      readyForPickup,
      done,
      ongoingJobs,
      receivedToday,
      appointmentsToday,
      partsOrderedJobs,
      unassignedJobs,
      totalManHours,
      todayManHours,
      mechanicLoads,
      completedToday,
    };
  }, [jobs, today]);

  if (!eodModalOpen) return null;

  const exportCSV = () => {
    const rows = [];
    rows.push([
      'Queue #', 'Status', 'Customer', 'Phone', 'Year', 'Make', 'Model',
      'Plate', 'Odometer', 'VIN', 'Reason for Visit', 'Front Desk Lead', 'Assigned Mechanic',
      'Appointment Date', 'Preferred Time', 'Est. Man-Hours', 'Est. Completion',
      'Parts Ordered', 'Date Received', 'Internal Notes',
    ].join(','));

    jobs.forEach((j) => {
      const escape = (val) => {
        const str = String(val || '');
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      };
      const rfv = Array.isArray(j.reasonForVisit) ? j.reasonForVisit.join('; ') : j.reasonForVisit;
      rows.push([
        escape(j.queueNumber),
        escape(STATUS_LABELS[j.status] || j.status),
        escape(j.customerName),
        escape(j.phoneNumber),
        escape(j.year),
        escape(j.make),
        escape(j.model),
        escape(j.plateNumber),
        escape(j.odometerReading),
        escape(j.vin),
        escape(rfv),
        escape(j.frontDeskLead),
        escape(j.assignedMechanic),
        escape(j.appointmentDate),
        escape(j.preferredTime ? to12Hour(j.preferredTime) : ''),
        escape(j.estimatedManHours),
        escape(j.estimatedCompletion ? to12Hour(j.estimatedCompletion) : ''),
        j.partsOrdered ? 'Yes' : 'No',
        escape(j.dateReceived),
        escape(j.internalNotes),
      ].join(','));
    });

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CBROS_EOD_Report_${todayISO}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const statusBadge = (status) => {
      const colors = {
        WAITLIST: '#64748b',
        IN_SERVICE: '#2563eb',
        AWAITING_PARTS: '#d97706',
        READY_FOR_PICKUP: '#059669',
        DONE: '#0d9488',
      };
      return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;color:white;background:${colors[status] || '#6b7280'}">${STATUS_LABELS[status] || status}</span>`;
    };

    const jobRows = jobs.map((j) => {
      const rfv = Array.isArray(j.reasonForVisit) ? j.reasonForVisit.join(', ') : (j.reasonForVisit || '');
      const isOngoing = j.status === JOB_STATUSES.WAITLIST || j.status === JOB_STATUSES.IN_SERVICE || j.status === JOB_STATUSES.AWAITING_PARTS;
      return `<tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:6px 8px;font-family:monospace;font-weight:700;color:#2563eb">${j.queueNumber || '-'}</td>
        <td style="padding:6px 8px">${statusBadge(j.status)}${isOngoing ? ' <span style="color:#d97706;font-size:10px;font-weight:600">ONGOING</span>' : ''}</td>
        <td style="padding:6px 8px;font-weight:600">${j.year} ${j.make} ${j.model}</td>
        <td style="padding:6px 8px">${j.plateNumber || '-'}</td>
        <td style="padding:6px 8px">${j.customerName}</td>
        <td style="padding:6px 8px">${j.assignedMechanic ? (mechanics.find(m => m.name === j.assignedMechanic)?.shortName || j.assignedMechanic) : '<span style="color:#ef4444">Unassigned</span>'}</td>
        <td style="padding:6px 8px">${j.estimatedManHours || '-'}</td>
        <td style="padding:6px 8px;font-size:11px;color:#6b7280;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${rfv || '-'}</td>
      </tr>`;
    }).join('');

    const mechanicRows = Object.entries(report.mechanicLoads)
      .sort((a, b) => b[1].hours - a[1].hours)
      .map(([mechName, data]) => {
        const color = data.hours >= 8 ? '#ef4444' : data.hours >= 5 ? '#f59e0b' : '#10b981';
        const pct = Math.min((data.hours / 10) * 100, 100);
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;margin:4px 0;border-radius:8px;border:1px solid #e5e7eb;background:#f9fafb;font-size:12px">
          <strong style="min-width:80px;white-space:nowrap">${mechanics.find(m => m.name === mechName)?.shortName || mechName}</strong>
          <div style="flex:1;height:10px;background:#e5e7eb;border-radius:5px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:5px"></div>
          </div>
          <span style="font-weight:700;color:${color};min-width:70px;text-align:right;font-size:11px">${data.hours.toFixed(1)}h &middot; ${data.jobs} job${data.jobs !== 1 ? 's' : ''}</span>
        </div>`;
      }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>CBROS EOD Report - ${today}</title>
  <style>
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; margin: 0; padding: 24px; font-size: 12px; }
    .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-size: 20px; font-weight: 800; color: #1e3a5f; margin: 0; letter-spacing: 2px; text-transform: uppercase; }
    .header p { color: #6b7280; margin: 4px 0 0; font-size: 12px; }
    .stats { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
    .stat-card { flex: 1; min-width: 120px; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; text-align: center; }
    .stat-card .value { font-size: 24px; font-weight: 800; }
    .stat-card .label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; margin: 20px 0 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; padding: 8px; font-weight: 600; color: #6b7280; border-bottom: 2px solid #d1d5db; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 6px 8px; vertical-align: top; }
    .ongoing-badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; background: #fef3c7; color: #92400e; margin-left: 4px; }
    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>CBROS Auto Service Division</h1>
    <p>End of Day Report &mdash; ${today} at ${nowTime}</p>
  </div>

  <div class="stats">
    <div class="stat-card"><div class="value" style="color:#2563eb">${report.total}</div><div class="label">Total Jobs</div></div>
    <div class="stat-card"><div class="value" style="color:#64748b">${report.waitlist.length}</div><div class="label">Waitlist</div></div>
    <div class="stat-card"><div class="value" style="color:#2563eb">${report.inService.length}</div><div class="label">In-Service</div></div>
    <div class="stat-card"><div class="value" style="color:#d97706">${report.awaitingParts.length}</div><div class="label">Awaiting Parts</div></div>
    <div class="stat-card"><div class="value" style="color:#059669">${report.readyForPickup.length}</div><div class="label">Ready for Pickup</div></div>
    <div class="stat-card"><div class="value" style="color:#0d9488">${report.done.length}</div><div class="label">Done</div></div>
  </div>

  <div class="stats">
    <div class="stat-card"><div class="value" style="color:#d97706">${report.ongoingJobs.length}</div><div class="label">Ongoing (Carry Over)</div></div>
    <div class="stat-card"><div class="value" style="color:#2563eb">${report.receivedToday.length}</div><div class="label">Received Today</div></div>
    <div class="stat-card"><div class="value" style="color:#64748b">${report.totalManHours.toFixed(1)}</div><div class="label">Total Man-Hours</div></div>
    <div class="stat-card"><div class="value" style="color:#ef4444">${report.unassignedJobs.length}</div><div class="label">Unassigned</div></div>
  </div>

  ${mechanicRows ? `<div class="section-title">Mechanic Workload</div><div style="margin-bottom:16px">${mechanicRows}</div>` : ''}

  ${report.completedToday.length > 0 ? `
  <div class="section-title" style="color:#0d9488;border-bottom-color:#99f6e4">Completed Jobs (${report.completedToday.length}) &mdash; Sorted by Intake Time (FIFO)</div>
  <table style="margin-bottom:20px">
    <thead>
      <tr>
        <th>Queue #</th><th>Intake Time</th><th>Vehicle</th><th>Plate #</th><th>Service Started</th><th>Time Completed</th>
      </tr>
    </thead>
    <tbody>${report.completedToday.map((j) => `<tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:6px 8px;font-family:monospace;font-weight:700;color:#2563eb">${j.queueNumber || '-'}</td>
        <td style="padding:6px 8px;font-weight:600">${j.intakeTimestamp || '-'}</td>
        <td style="padding:6px 8px;font-weight:600">${j.year} ${j.make} ${j.model}</td>
        <td style="padding:6px 8px;font-family:monospace">${j.plateNumber || '-'}</td>
        <td style="padding:6px 8px"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;color:white;background:#2563eb">${j.serviceStartedAt || '-'}</span></td>
        <td style="padding:6px 8px"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;color:white;background:#0d9488">${j.paidAt || j.doneAt || '-'}</span></td>
      </tr>`).join('')}</tbody>
  </table>` : ''}

  <div class="section-title">All Jobs Summary</div>
  <table>
    <thead>
      <tr>
        <th>Queue #</th><th>Status</th><th>Vehicle</th><th>Plate</th><th>Customer</th><th>Mechanic</th><th>Hours</th><th>Services</th>
      </tr>
    </thead>
    <tbody>${jobRows}</tbody>
  </table>

  <div class="footer">
    CBROS Auto Service Division &mdash; End of Day Report &mdash; Generated ${today} at ${nowTime}
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  const StatCard = ({ icon: Icon, label, value, color = 'blue' }) => {
    const colors = {
      blue: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      green: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      red: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
      slate: 'bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      teal: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    };
    return (
      <div className={`flex items-center gap-3 p-3 rounded-lg border ${colors[color]}`}>
        <Icon className="w-5 h-5 shrink-0" />
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-8 pb-8 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={closeEodModal} />
      <div className="relative w-full max-w-3xl mx-4 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              End of Day Report
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Report generated: {today} at {nowTime}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportPDF}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Export PDF
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={closeEodModal}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary cards */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-3">
              Daily Overview
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <StatCard icon={Car} label="Total Jobs" value={report.total} color="blue" />
              <StatCard icon={ClipboardList} label="Waitlist" value={report.waitlist.length} color="slate" />
              <StatCard icon={Settings} label="In-Service" value={report.inService.length} color="blue" />
              <StatCard icon={CheckCircle2} label="Ready for Pickup" value={report.readyForPickup.length} color="green" />
              <StatCard icon={BadgeCheck} label="Done" value={report.done.length} color="teal" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={Package} label="Awaiting Parts" value={report.awaitingParts.length} color="amber" />
            <StatCard icon={FileText} label="Received Today" value={report.receivedToday.length} color="blue" />
            <StatCard icon={Wrench} label="Unassigned" value={report.unassignedJobs.length} color="red" />
            <StatCard icon={Clock} label="Total Man-Hours" value={report.totalManHours.toFixed(1)} color="slate" />
          </div>

          {/* Ongoing Jobs — carry over to next day */}
          {report.ongoingJobs.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-3 flex items-center gap-2">
                Ongoing — Carry Over ({report.ongoingJobs.length})
                <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  Auto-persist to next day
                </span>
              </h3>
              <div className="space-y-1.5">
                {report.ongoingJobs.map((j) => (
                  <div
                    key={j.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs"
                  >
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{j.queueNumber || '-'}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      j.status === JOB_STATUSES.IN_SERVICE
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                        : j.status === JOB_STATUSES.AWAITING_PARTS
                        ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {STATUS_LABELS[j.status]}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">{j.year} {j.make} {j.model}</span>
                    <span className="text-gray-500 dark:text-gray-400">{j.customerName}</span>
                    <span className="ml-auto text-amber-700 dark:text-amber-300 font-semibold text-[10px] uppercase">
                      Ongoing
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Jobs — sorted by intake time (FIFO) */}
          {report.completedToday.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-3 flex items-center gap-2">
                <BadgeCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Completed Jobs ({report.completedToday.length})
                <span className="text-[10px] font-normal text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
                  Sorted by Intake Time (FIFO)
                </span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Queue #</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Intake Time</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Vehicle</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Plate #</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Service Started</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Time Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.completedToday.map((j) => (
                      <tr key={j.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-teal-50/50 dark:hover:bg-teal-950/20">
                        <td className="py-2 px-2 font-mono font-bold text-blue-600 dark:text-blue-400">{j.queueNumber || '-'}</td>
                        <td className="py-2 px-2 font-medium text-gray-700 dark:text-gray-300">{j.intakeTimestamp || '-'}</td>
                        <td className="py-2 px-2 font-medium text-gray-900 dark:text-white">{j.year} {j.make} {j.model}</td>
                        <td className="py-2 px-2 text-gray-600 dark:text-gray-400 font-mono">{j.plateNumber || '-'}</td>
                        <td className="py-2 px-2">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium text-[10px]">
                            <Settings className="w-3 h-3" />
                            {j.serviceStartedAt || '-'}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 font-medium text-[10px]">
                            <CheckCircle2 className="w-3 h-3" />
                            {j.paidAt || j.doneAt || '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Today's appointments */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-3">
              Today's Appointments ({report.appointmentsToday.length})
            </h3>
            {report.appointmentsToday.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                No appointments for today
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Queue #</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Vehicle</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Customer</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Time</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Mechanic</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Hours</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.appointmentsToday.map((j) => (
                      <tr key={j.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-2 px-2 font-mono font-bold text-blue-600 dark:text-blue-400">{j.queueNumber || '-'}</td>
                        <td className="py-2 px-2 font-medium text-gray-900 dark:text-white">{j.year} {j.make} {j.model}</td>
                        <td className="py-2 px-2 text-gray-600 dark:text-gray-400">{j.customerName}</td>
                        <td className="py-2 px-2 text-gray-600 dark:text-gray-400">{j.preferredTime ? to12Hour(j.preferredTime) : '-'}</td>
                        <td className="py-2 px-2">
                          {j.assignedMechanic ? (
                            <span className="text-gray-600 dark:text-gray-400">
                              {mechanics.find((m) => m.name === j.assignedMechanic)?.shortName || j.assignedMechanic}
                            </span>
                          ) : (
                            <span className="text-red-500 font-medium">Unassigned</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-gray-600 dark:text-gray-400">{j.estimatedManHours || '-'}</td>
                        <td className="py-2 px-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            j.status === JOB_STATUSES.DONE
                              ? 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300'
                              : j.status === JOB_STATUSES.READY_FOR_PICKUP
                              ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                              : j.status === JOB_STATUSES.IN_SERVICE
                              ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                              : j.status === JOB_STATUSES.AWAITING_PARTS
                              ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}>
                            {STATUS_LABELS[j.status] || j.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Mechanic workloads — progress bars */}
          {Object.keys(report.mechanicLoads).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                Mechanic Workload
                <div className="ml-auto flex items-center gap-3 text-[9px] font-semibold text-gray-400 dark:text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />0-5h</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />5-8h</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />8h+</span>
                </div>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(report.mechanicLoads)
                  .sort((a, b) => b[1].hours - a[1].hours)
                  .map(([mechName, data]) => {
                    const pct = Math.min((data.hours / 10) * 100, 100);
                    const barColor = data.hours >= 8
                      ? 'bg-red-500 dark:bg-red-400'
                      : data.hours >= 5
                      ? 'bg-amber-500 dark:bg-amber-400'
                      : 'bg-emerald-500 dark:bg-emerald-400';
                    const textColor = data.hours >= 8
                      ? 'text-red-600 dark:text-red-400'
                      : data.hours >= 5
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400';
                    return (
                      <div
                        key={mechName}
                        className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                      >
                        <Wrench className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                              {mechanics.find((m) => m.name === mechName)?.shortName || mechName}
                            </span>
                            <span className={`text-[10px] font-bold ${textColor}`}>
                              {data.hours.toFixed(1)}h &middot; {data.jobs} job{data.jobs !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Parts on order */}
          {report.partsOrderedJobs.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-3">
                Parts on Order ({report.partsOrderedJobs.length})
              </h3>
              <div className="space-y-1.5">
                {report.partsOrderedJobs.map((j) => (
                  <div
                    key={j.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs"
                  >
                    <Package className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{j.queueNumber || '-'}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{j.year} {j.make} {j.model}</span>
                    <span className="text-gray-500 dark:text-gray-400">{j.customerName}</span>
                    <span className="ml-auto text-amber-700 dark:text-amber-300 font-medium">
                      {STATUS_LABELS[j.status]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
