import { useMemo, useState, useRef, useEffect } from 'react';
import { X, Download, FileText, Car, Wrench, Clock, CheckCircle2, Settings, Package, ClipboardList, BadgeCheck, Printer, Ban, Archive, ShieldCheck, Lock } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useJobsStore, to12Hour } from '../../stores/jobsStore';
import { JOB_STATUSES, STATUS_LABELS } from '../../data/rosters';
import { useAdminStore, getMechanicDisplay } from '../../stores/adminStore';

/**
 * Parse a "MM/dd/yyyy at hh:mm AM/PM" string into a Date object.
 */
const parseDateTimestamp = (str) => {
  if (!str) return null;
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4}) at (\d{2}):(\d{2}) (AM|PM)$/);
  if (!match) return null;
  const [, month, day, year, hours, mins, ampm] = match;
  let h = parseInt(hours, 10);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), h, parseInt(mins));
};

/**
 * Compute actual labor hours from serviceStartedAt → serviceDoneTime.
 * Returns null if either timestamp is missing or unparseable.
 */
const computeActualHours = (job) => {
  if (!job.serviceStartedAt || !job.serviceDoneTime) return null;
  const start = parseDateTimestamp(job.serviceStartedAt);
  const end = parseDateTimestamp(job.serviceDoneTime);
  if (!start || !end) return null;
  return Math.max(0, (end - start) / (1000 * 60 * 60));
};

/**
 * Extract the date portion ("MM/dd/yyyy") from a "MM/dd/yyyy at HH:mm AM/PM" timestamp.
 */
const extractDateFromTimestamp = (str) => {
  if (!str) return null;
  const match = str.match(/^(\d{2}\/\d{2}\/\d{4})/);
  return match ? match[1] : null;
};

/**
 * Check if a job is relevant to today's EOD report.
 *
 * Rules:
 *  1. If the job has an appointmentDate in the FUTURE (not today),
 *     only include it if service was actually started or completed today.
 *  2. If appointmentDate === today → always include.
 *  3. If no appointmentDate (walk-in) → include if received today or had activity today.
 */
const isRelevantToday = (job, todayStr) => {
  // ── Jobs with a future appointment date ──
  // Exclude unless service was actively worked on / completed today
  if (job.appointmentDate && job.appointmentDate !== todayStr) {
    if (extractDateFromTimestamp(job.serviceStartedAt) === todayStr) return true;
    if (extractDateFromTimestamp(job.serviceDoneTime) === todayStr) return true;
    return false;
  }

  // ── Scheduled for today ──
  if (job.appointmentDate === todayStr) return true;

  // ── Walk-ins (no appointmentDate) ──
  // Include if received today or had service activity today
  if (job.dateReceived === todayStr) return true;
  if (extractDateFromTimestamp(job.serviceStartedAt) === todayStr) return true;
  if (extractDateFromTimestamp(job.serviceDoneTime) === todayStr) return true;

  return false;
};

export default function EODReportModal() {
  const { eodModalOpen, closeEodModal } = useUIStore();
  const jobs = useJobsStore((s) => s.jobs);
  const closeOutDay = useJobsStore((s) => s.closeOutDay);
  const mechanics = useAdminStore((s) => s.mechanics);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [closeOutDone, setCloseOutDone] = useState(false);
  const [closingOut, setClosingOut] = useState(false);
  const [closeOutError, setCloseOutError] = useState(null);
  const pinInputRef = useRef(null);

  // Philippine Standard Time (UTC+8) date calculations
  const pstNow = new Date();
  const today = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(pstNow);
  const todayISO = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(pstNow);
  const nowTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(pstNow);

  const report = useMemo(() => {
    // Filter to jobs relevant to today: received today, scheduled today, or with service activity today
    const allJobs = jobs.filter((j) => isRelevantToday(j, today));

    // Unfiltered counts for Close Out Day section (archives ALL done/cancelled regardless of daily filter)
    const closeOutDoneCount = jobs.filter((j) => j.status === JOB_STATUSES.DONE).length;
    const closeOutOngoingCount = jobs.filter(
      (j) =>
        j.status === JOB_STATUSES.WAITLIST ||
        j.status === JOB_STATUSES.IN_SERVICE ||
        j.status === JOB_STATUSES.AWAITING_PARTS ||
        j.status === JOB_STATUSES.READY_FOR_PICKUP
    ).length;

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

    // Unassigned jobs — exclude cancelled jobs (they naturally lack a mechanic)
    const unassignedJobs = allJobs.filter((j) => !j.assignedMechanic && !j.isCanceled);

    // Total man-hours: actual labor time (serviceStarted → serviceDone) where available,
    // falls back to estimated hours for jobs still in progress
    const totalManHours = allJobs.reduce((sum, j) => {
      const actual = computeActualHours(j);
      if (actual !== null) return sum + actual;
      if (j.estimatedManHours) return sum + j.estimatedManHours;
      return sum;
    }, 0);

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

    // Cancelled jobs
    const canceledJobs = allJobs.filter((j) => j.isCanceled);

    // Completed Jobs — ALL jobs in DONE column, sorted by intake time (FIFO)
    // No filter constraints — includes every completed/cancelled job
    const completedToday = [...done]
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      });

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
      canceledJobs,
      closeOutDoneCount,
      closeOutOngoingCount,
      allReportJobs: allJobs,
    };
  }, [jobs, today]);

  if (!eodModalOpen) return null;

  const exportCSV = () => {
    const rows = [];
    // Headers
    rows.push([
      'Intake #', 'Status', 'Customer', 'Phone', 'Year', 'Make', 'Model',
      'Plate #', 'Odometer', 'VIN', 'Services Rendered', 'Front Desk Lead',
      'Lead Mechanic', 'Assistant Mechanic', 'Appointment Date', 'Preferred Time',
      'Est. Man-Hours', 'Actual Hours', 'Est. Completion',
      'Parts Ordered', 'Date Received', 'Intake Time', 'Service Started', 'Service Completed',
      'Paid', 'Internal Notes',
    ].join(','));

    // Filtered jobs sorted by intake time — only today's relevant jobs
    const allReportJobs = [...report.allReportJobs].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });

    allReportJobs.forEach((j) => {
      // Always quote fields for Excel 2019 compatibility
      const escape = (val) => {
        const str = String(val ?? '');
        return `"${str.replace(/"/g, '""')}"`;
      };
      const rfv = Array.isArray(j.reasonForVisit) ? j.reasonForVisit.join('; ') : (j.reasonForVisit || '');
      const actualHours = computeActualHours(j);
      rows.push([
        escape(j.queueNumber),
        escape(j.isCanceled ? 'CANCELLED' : (STATUS_LABELS[j.status] || j.status)),
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
        escape(j.assistantMechanic),
        escape(j.appointmentDate),
        escape(j.preferredTime ? to12Hour(j.preferredTime) : ''),
        escape(j.estimatedManHours || ''),
        escape(actualHours !== null ? actualHours.toFixed(2) : ''),
        escape(j.estimatedCompletion ? to12Hour(j.estimatedCompletion) : ''),
        escape(j.partsOrdered ? 'Yes' : 'No'),
        escape(j.dateReceived),
        escape(j.intakeTimestamp || ''),
        escape(j.serviceStartedAt || ''),
        escape(j.serviceDoneTime || ''),
        escape(j.isPaid ? 'Yes' : 'No'),
        escape(j.internalNotes),
      ].join(','));
    });

    // UTF-8 BOM + CRLF line endings for Excel 2019 compatibility
    const bom = '\uFEFF';
    const csv = bom + rows.join('\r\n');
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

  // Helper: extract just the time portion from timestamp strings
  const extractTime = (timestamp) => {
    if (!timestamp) return '-';
    // "MM/dd/yyyy at HH:mm AM/PM" → "HH:mm AM/PM"
    const atMatch = timestamp.match(/at\s+(.+)$/);
    if (atMatch) return atMatch[1];
    // Already time-only "HH:mm AM/PM"
    if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(timestamp)) return timestamp;
    return timestamp;
  };

  // Helper: get the service done time with fallback logic (matches JobListView)
  const getServiceDoneTime = (job) => {
    if (job.isCanceled && job.canceledAt) return job.canceledAt;
    if (job.serviceDoneTime) return job.serviceDoneTime;
    if (job.paidAt) return job.paidAt;
    if (job.doneAt) return job.doneAt;
    return null;
  };

  const exportPDF = () => {
    // Completed jobs table — columns: Intake #, Vehicle, Services Rendered, Mechanic, Intake Time, Service Start, Service Done, Total
    const completedJobRows = report.completedToday.map((j) => {
      const services = Array.isArray(j.reasonForVisit) ? j.reasonForVisit.join(', ') : (j.reasonForVisit || '-');
      const mechDisplay = j.assignedMechanic ? getMechanicDisplay(j.assignedMechanic, mechanics) : '<span style="color:#ef4444">Unassigned</span>';
      const actualHours = computeActualHours(j);
      const totalDisplay = actualHours !== null
        ? actualHours.toFixed(1) + 'h'
        : (j.estimatedManHours ? j.estimatedManHours + 'h*' : '-');
      const cancelledBadge = j.isCanceled ? '<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:9px;font-weight:700;background:#fee2e2;color:#991b1b;margin-left:4px">CANCELLED</span>' : '';
      const intakeTime = j.intakeTimestamp || '-';
      const serviceStart = j.isCanceled ? '<span style="color:#991b1b">—</span>' : extractTime(j.serviceStartedAt);
      const serviceDone = j.isCanceled
        ? `<span style="color:#991b1b">${j.canceledAt || '—'}</span>`
        : extractTime(getServiceDoneTime(j));

      return `<tr style="border-bottom:1px solid #e5e7eb${j.isCanceled ? ';background:#fef2f2' : ''}">
        <td style="padding:6px 8px;font-family:'Courier New',monospace;font-weight:700;color:#2563eb;white-space:nowrap;vertical-align:top">${j.queueNumber || '-'}${cancelledBadge}</td>
        <td style="padding:6px 8px;vertical-align:top">
          <div style="font-weight:600">${j.year} ${j.make} ${j.model}</div>
          ${j.plateNumber ? `<div style="font-size:10px;color:#6b7280">${j.plateNumber}</div>` : ''}
        </td>
        <td style="padding:6px 8px;font-size:11px;line-height:1.5;word-wrap:break-word;overflow-wrap:break-word;max-width:180px;vertical-align:top">${services}</td>
        <td style="padding:6px 8px;white-space:nowrap;vertical-align:top">${mechDisplay}${j.assistantMechanic ? `<div style="font-size:10px;color:#6b7280">+ ${getMechanicDisplay(j.assistantMechanic, mechanics)}</div>` : ''}</td>
        <td style="padding:6px 8px;white-space:nowrap;font-size:10px;color:#374151;vertical-align:top">${intakeTime}</td>
        <td style="padding:6px 8px;white-space:nowrap;font-size:10px;color:#2563eb;vertical-align:top">${serviceStart}</td>
        <td style="padding:6px 8px;white-space:nowrap;font-size:10px;color:#0d9488;vertical-align:top">${serviceDone}</td>
        <td style="padding:6px 8px;text-align:right;font-weight:700;white-space:nowrap;vertical-align:top">${totalDisplay}</td>
      </tr>`;
    }).join('');

    // Ongoing jobs table
    const ongoingJobRows = report.ongoingJobs.map((j) => {
      const services = Array.isArray(j.reasonForVisit) ? j.reasonForVisit.join(', ') : (j.reasonForVisit || '-');
      const mechDisplay = j.assignedMechanic ? getMechanicDisplay(j.assignedMechanic, mechanics) : '<span style="color:#ef4444">Unassigned</span>';
      const statusLabel = STATUS_LABELS[j.status] || j.status;
      const intakeTime = j.intakeTimestamp || '-';
      const serviceStart = extractTime(j.serviceStartedAt);

      return `<tr style="border-bottom:1px solid #e5e7eb;background:#fffbeb">
        <td style="padding:6px 8px;font-family:'Courier New',monospace;font-weight:700;color:#2563eb;white-space:nowrap;vertical-align:top">${j.queueNumber || '-'}</td>
        <td style="padding:6px 8px;vertical-align:top">
          <div style="font-weight:600">${j.year} ${j.make} ${j.model}</div>
          ${j.plateNumber ? `<div style="font-size:10px;color:#6b7280">${j.plateNumber}</div>` : ''}
        </td>
        <td style="padding:6px 8px;font-size:11px;line-height:1.5;word-wrap:break-word;overflow-wrap:break-word;max-width:180px;vertical-align:top">${services}</td>
        <td style="padding:6px 8px;white-space:nowrap;vertical-align:top">${mechDisplay}</td>
        <td style="padding:6px 8px;white-space:nowrap;font-size:10px;color:#374151;vertical-align:top">${intakeTime}</td>
        <td style="padding:6px 8px;white-space:nowrap;font-size:10px;color:#2563eb;vertical-align:top">${serviceStart}</td>
        <td style="padding:6px 8px;text-align:center;vertical-align:top"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;color:#92400e;background:#fef3c7">${statusLabel}</span></td>
      </tr>`;
    }).join('');

    // Mechanic workload bars
    const mechanicRows = Object.entries(report.mechanicLoads)
      .sort((a, b) => b[1].hours - a[1].hours)
      .map(([mechName, data]) => {
        const color = data.hours >= 8 ? '#ef4444' : data.hours >= 5 ? '#f59e0b' : '#10b981';
        const pct = Math.min((data.hours / 10) * 100, 100);
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;margin:4px 0;border-radius:8px;border:1px solid #e5e7eb;background:#f9fafb;font-size:12px">
          <strong style="min-width:100px;white-space:nowrap">${getMechanicDisplay(mechName, mechanics)}</strong>
          <div style="flex:1;height:10px;background:#e5e7eb;border-radius:5px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:5px"></div>
          </div>
          <span style="font-weight:700;color:${color};min-width:80px;text-align:right;font-size:11px">${data.hours.toFixed(1)}h &middot; ${data.jobs} job${data.jobs !== 1 ? 's' : ''}</span>
        </div>`;
      }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>CBROS EOD Report - ${today}</title>
  <style>
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; margin: 0; padding: 24px; font-size: 12px; }
    .header { text-align: center; border-bottom: 3px solid #1e3a5f; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-size: 22px; font-weight: 800; color: #1e3a5f; margin: 0; letter-spacing: 2px; text-transform: uppercase; }
    .header p { color: #6b7280; margin: 4px 0 0; font-size: 12px; }
    .stats { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
    .stat-card { flex: 1; min-width: 100px; padding: 10px; border-radius: 8px; border: 1px solid #e5e7eb; text-align: center; }
    .stat-card .value { font-size: 22px; font-weight: 800; }
    .stat-card .label { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; margin: 24px 0 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; padding: 8px 10px; font-weight: 600; color: #6b7280; border-bottom: 2px solid #d1d5db; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { vertical-align: top; }
    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
    .note { font-size: 9px; color: #9ca3af; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>CBROS Auto Service Division</h1>
    <p>End of Day Report &mdash; ${today} at ${nowTime} (Philippine Standard Time)</p>
  </div>

  <div class="stats">
    <div class="stat-card"><div class="value" style="color:#2563eb">${report.total}</div><div class="label">Total Jobs</div></div>
    <div class="stat-card"><div class="value" style="color:#0d9488">${report.done.length}</div><div class="label">Completed</div></div>
    <div class="stat-card"><div class="value" style="color:#d97706">${report.ongoingJobs.length}</div><div class="label">Ongoing</div></div>
    <div class="stat-card"><div class="value" style="color:#ef4444">${report.canceledJobs.length}</div><div class="label">Cancelled</div></div>
    <div class="stat-card"><div class="value" style="color:#64748b">${report.totalManHours.toFixed(1)}</div><div class="label">Total Hours</div></div>
  </div>

  ${mechanicRows ? `<div class="section-title">Mechanic Workload</div><div style="margin-bottom:16px">${mechanicRows}</div>` : ''}

  ${report.completedToday.length > 0 ? `
  <div class="section-title" style="color:#0d9488;border-bottom-color:#99f6e4">Completed Jobs (${report.completedToday.length})</div>
  <table style="margin-bottom:16px">
    <thead>
      <tr>
        <th style="width:75px">Intake #</th>
        <th style="width:120px">Vehicle</th>
        <th>Services Rendered</th>
        <th style="width:90px">Mechanic</th>
        <th style="width:70px">Intake Time</th>
        <th style="width:70px">Svc Start</th>
        <th style="width:70px">Svc Done</th>
        <th style="width:50px;text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${completedJobRows}</tbody>
  </table>
  <p class="note">* Estimated hours (actual not yet recorded)</p>` : '<p style="color:#9ca3af;text-align:center;padding:20px 0">No completed jobs.</p>'}

  ${report.ongoingJobs.length > 0 ? `
  <div class="section-title" style="color:#d97706;border-bottom-color:#fde68a">Ongoing Jobs &mdash; Carry Over (${report.ongoingJobs.length})</div>
  <table style="margin-bottom:16px">
    <thead>
      <tr>
        <th style="width:75px">Intake #</th>
        <th style="width:120px">Vehicle</th>
        <th>Services Rendered</th>
        <th style="width:90px">Mechanic</th>
        <th style="width:70px">Intake Time</th>
        <th style="width:70px">Svc Start</th>
        <th style="width:65px;text-align:center">Status</th>
      </tr>
    </thead>
    <tbody>${ongoingJobRows}</tbody>
  </table>` : ''}

  <div class="footer">
    CBROS Auto Service Division &mdash; End of Day Report &mdash; Generated ${today} at ${nowTime} PST
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=1050,height=700');
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

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard icon={Package} label="Awaiting Parts" value={report.awaitingParts.length} color="amber" />
            <StatCard icon={FileText} label="Received Today" value={report.receivedToday.length} color="blue" />
            <StatCard icon={Wrench} label="Unassigned" value={report.unassignedJobs.length} color="red" />
            <StatCard icon={Ban} label="Cancelled" value={report.canceledJobs.length} color="red" />
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
                      <tr key={j.id} className={`border-b border-gray-100 dark:border-gray-800 ${j.isCanceled ? 'bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30' : 'hover:bg-teal-50/50 dark:hover:bg-teal-950/20'}`}>
                        <td className="py-2 px-2 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {j.queueNumber || '-'}
                          {j.isCanceled && (
                            <span className="ml-1 inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-bold text-[9px]">
                              <Ban className="w-2.5 h-2.5" />
                              CANCELLED
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 font-medium text-gray-700 dark:text-gray-300">{j.intakeTimestamp || '-'}</td>
                        <td className={`py-2 px-2 font-medium ${j.isCanceled ? 'text-red-700 dark:text-red-300 line-through' : 'text-gray-900 dark:text-white'}`}>{j.year} {j.make} {j.model}</td>
                        <td className="py-2 px-2 text-gray-600 dark:text-gray-400 font-mono">{j.plateNumber || '-'}</td>
                        <td className="py-2 px-2">
                          {j.isCanceled ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-medium text-[10px]">
                              <Ban className="w-3 h-3" />
                              Cancelled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium text-[10px]">
                              <Settings className="w-3 h-3" />
                              {j.serviceStartedAt || '-'}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          {j.isCanceled ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-medium text-[10px]">
                              {j.canceledAt || '-'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 font-medium text-[10px]">
                              <CheckCircle2 className="w-3 h-3" />
                              {j.serviceDoneTime || j.paidAt || j.doneAt || '-'}
                            </span>
                          )}
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
                              {getMechanicDisplay(j.assignedMechanic, mechanics)}
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
                              {getMechanicDisplay(mechName, mechanics)}
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

          {/* ── Close Out Day ────────────────────────────────────── */}
          <div className="pt-4 border-t-2 border-gray-200 dark:border-gray-700">
            <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-300 dark:border-orange-700 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <Archive className="w-6 h-6 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-orange-800 dark:text-orange-200">Close Out Day</h3>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    Archive all <strong>Done</strong> and <strong>Cancelled</strong> jobs ({report.closeOutDoneCount} jobs).
                    Active jobs ({report.closeOutOngoingCount} jobs in Waitlist, In-Service, Awaiting Parts, Ready for Pickup) will carry over to the next day.
                  </p>
                  {closeOutDone ? (
                    <div className="mt-3 flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="w-5 h-5" />
                      Day closed out successfully! {report.closeOutDoneCount} jobs archived.
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setShowPinModal(true);
                        setPin('');
                        setPinError(false);
                      }}
                      disabled={report.closeOutDoneCount === 0}
                      className="mt-3 flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                      <Lock className="w-4 h-4" />
                      Close Out Day
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── PIN Authorization Modal ──────────────────────────── */}
        {showPinModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60" onClick={() => { setShowPinModal(false); setPin(''); setPinError(false); }} />
            <div className="relative w-full max-w-sm mx-4 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 animate-slide-in">
              {/* Header */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="p-2 bg-orange-100 dark:bg-orange-950/40 rounded-lg">
                  <ShieldCheck className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Authorize End of Day</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">PIN required to proceed</p>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Please enter the authorization PIN to close the shop for today.
                </p>

                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Authorization PIN
                </label>
                <input
                  ref={pinInputRef}
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, ''));
                    if (pinError) setPinError(false);
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (pin === '112009') {
                        setClosingOut(true);
                        setCloseOutError(null);
                        try {
                          await closeOutDay();
                          setCloseOutDone(true);
                          setShowPinModal(false);
                        } catch (err) {
                          setCloseOutError('Failed to close out day. Please try again.');
                        } finally {
                          setClosingOut(false);
                          setPin('');
                          setPinError(false);
                        }
                      } else {
                        setPinError(true);
                        setPin('');
                      }
                    }
                  }}
                  placeholder="••••••"
                  autoFocus
                  className={`w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] rounded-lg border-2 transition-colors outline-none ${
                    pinError
                      ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-950/30 focus:border-red-500 dark:focus:border-red-400'
                      : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 focus:border-orange-500 dark:focus:border-orange-400'
                  }`}
                />

                {/* Error message */}
                {pinError && (
                  <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-red-600 dark:text-red-400">
                    <X className="w-4 h-4" />
                    Invalid PIN. Access Denied.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowPinModal(false);
                    setPin('');
                    setPinError(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (pin === '112009') {
                      setClosingOut(true);
                      setCloseOutError(null);
                      try {
                        await closeOutDay();
                        setCloseOutDone(true);
                        setShowPinModal(false);
                      } catch (err) {
                        setCloseOutError('Failed to close out day. Please try again.');
                      } finally {
                        setClosingOut(false);
                        setPin('');
                        setPinError(false);
                      }
                    } else {
                      setPinError(true);
                      setPin('');
                    }
                  }}
                  disabled={pin.length === 0 || closingOut}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {closingOut ? 'Closing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
