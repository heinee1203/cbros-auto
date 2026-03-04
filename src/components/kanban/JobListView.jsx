import { useState, useEffect, useMemo } from 'react';
import {
  Pencil,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Ban,
  Inbox,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useJobsStore, getMechanicWorkStatus } from '../../stores/jobsStore';
import { useAdminStore, getMechanicDisplay } from '../../stores/adminStore';
import { JOB_STATUSES, STATUS_LABELS } from '../../data/rosters';
import QuickViewModal from '../jobs/QuickViewModal';

const ROWS_PER_PAGE = 30;

// Status badge color map (matches Kanban column colors)
const STATUS_BADGE_COLORS = {
  [JOB_STATUSES.WAITLIST]: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  [JOB_STATUSES.IN_SERVICE]: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  [JOB_STATUSES.AWAITING_PARTS]: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
  [JOB_STATUSES.READY_FOR_PICKUP]: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
  [JOB_STATUSES.DONE]: 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300',
};

// Full-row background + hover color map by status
const ROW_COLORS = {
  [JOB_STATUSES.WAITLIST]: 'bg-gray-50 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800/70',
  [JOB_STATUSES.IN_SERVICE]: 'bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/40',
  [JOB_STATUSES.AWAITING_PARTS]: 'bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/40',
  [JOB_STATUSES.READY_FOR_PICKUP]: 'bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40',
  [JOB_STATUSES.DONE]: 'bg-teal-50 dark:bg-teal-950/20 hover:bg-teal-100 dark:hover:bg-teal-950/40',
};
const ROW_COLOR_CANCELLED = 'bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40';

// Statuses eligible for the Done/Paid quick action
const DONE_PAID_STATUSES = new Set([
  JOB_STATUSES.IN_SERVICE,
  JOB_STATUSES.AWAITING_PARTS,
  JOB_STATUSES.READY_FOR_PICKUP,
]);

export default function JobListView({ jobs }) {
  const setEditingJobId = useUIStore((s) => s.setEditingJobId);
  const setCancelingJobId = useUIStore((s) => s.setCancelingJobId);
  const markDonePaid = useJobsStore((s) => s.markDonePaid);
  const allJobs = useJobsStore((s) => s.jobs);
  const mechanics = useAdminStore((s) => s.mechanics);

  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [confirmDonePaidId, setConfirmDonePaidId] = useState(null); // job ID awaiting confirm
  const [quickViewJob, setQuickViewJob] = useState(null);

  // Sort jobs by queue number
  const sortedJobs = useMemo(() => {
    const sorted = [...jobs].sort((a, b) => {
      const qa = a.queueNumber || '';
      const qb = b.queueNumber || '';
      return qa.localeCompare(qb);
    });
    if (sortOrder === 'desc') sorted.reverse();
    return sorted;
  }, [jobs, sortOrder]);

  // Reset to page 1 when jobs list changes (filters applied, data changes)
  useEffect(() => {
    setCurrentPage(1);
  }, [jobs.length]);

  const totalPages = Math.max(1, Math.ceil(sortedJobs.length / ROWS_PER_PAGE));
  const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
  const pageJobs = sortedJobs.slice(startIdx, startIdx + ROWS_PER_PAGE);

  // Clamp page if out of range
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-600">
        <Inbox className="w-12 h-12 mb-3" />
        <p className="text-sm font-medium">No jobs found</p>
        <p className="text-xs mt-1">Try adjusting your filters or add a new intake.</p>
      </div>
    );
  }

  const toggleSort = () => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));

  const getStatusBadge = (job) => {
    if (job.isCanceled) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 whitespace-nowrap">
          <Ban className="w-3 h-3" />
          Cancelled
        </span>
      );
    }
    const colorCls = STATUS_BADGE_COLORS[job.status] || 'bg-gray-100 text-gray-700';
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${colorCls}`}>
        {STATUS_LABELS[job.status] || job.status}
      </span>
    );
  };

  const getRowColor = (job) => {
    if (job.isCanceled) return ROW_COLOR_CANCELLED;
    return ROW_COLORS[job.status] || 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800';
  };

  // Get the "Service Done" timestamp — uses serviceDoneTime (set on Ready for Pickup),
  // with fallback to paidAt/doneAt for legacy jobs
  const getServiceDoneTime = (job) => {
    if (job.isCanceled && job.canceledAt) return job.canceledAt;
    if (job.serviceDoneTime) return job.serviceDoneTime;
    if (job.paidAt) return job.paidAt;
    if (job.doneAt) return job.doneAt;
    return null;
  };

  const handleDonePaidClick = (job) => {
    if (confirmDonePaidId === job.id) {
      markDonePaid(job.id);
      setConfirmDonePaidId(null);
    } else {
      setConfirmDonePaidId(job.id);
    }
  };

  const thCls = 'text-left py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap';

  return (
    <div className="mt-4">
      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
              {/* 1. Queue # — sortable */}
              <th className={thCls}>
                <button
                  onClick={toggleSort}
                  className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-200 transition-colors group"
                >
                  Queue #
                  <span className="text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors">
                    {sortOrder === 'asc' ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </span>
                </button>
              </th>
              {/* 2. Intake Time */}
              <th className={thCls}>Intake Time</th>
              {/* 3. Status */}
              <th className={thCls}>Status</th>
              {/* 4. Vehicle (includes Plate/VIN) */}
              <th className={thCls}>Vehicle</th>
              {/* 5. Customer */}
              <th className={thCls}>Customer</th>
              {/* 6. Mechanic */}
              <th className={thCls}>Mechanic</th>
              {/* 7. Service Started */}
              <th className={thCls}>Service Started</th>
              {/* 8. Service Done */}
              <th className={thCls}>Service Done</th>
              {/* 9. Actions */}
              <th className="text-center py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageJobs.map((job) => {
              const isCanceled = !!job.isCanceled;
              const isWaitlist = job.status === JOB_STATUSES.WAITLIST;
              const isDone = job.status === JOB_STATUSES.DONE;
              const isLocked = isCanceled || isDone;
              const canDonePaid = !isCanceled && DONE_PAID_STATUSES.has(job.status);
              const serviceDone = getServiceDoneTime(job);
              const isConfirmingDonePaid = confirmDonePaidId === job.id;

              return (
                <tr
                  key={job.id}
                  className={`border-b border-gray-100 dark:border-gray-800 transition-colors ${getRowColor(job)}`}
                >
                  {/* 1. Queue # — clickable for Quick View */}
                  <td className="py-2 px-3">
                    <button
                      onClick={() => setQuickViewJob(job)}
                      className="inline-flex items-center text-xs font-bold text-blue-600 dark:text-blue-400 font-mono tracking-wide hover:underline hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer"
                      title={`Quick view: ${job.year} ${job.make} ${job.model}`}
                    >
                      {job.queueNumber || '-'}
                    </button>
                  </td>

                  {/* 2. Intake Time */}
                  <td className="py-2 px-3">
                    <div>
                      <p className="text-xs text-gray-700 dark:text-gray-300">
                        {job.dateReceived || '—'}
                      </p>
                      {job.intakeTimestamp && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          {job.intakeTimestamp}
                        </p>
                      )}
                    </div>
                  </td>

                  {/* 3. Status */}
                  <td className="py-2 px-3">
                    {getStatusBadge(job)}
                  </td>

                  {/* 4. Vehicle (Year Make Model + Plate + VIN) */}
                  <td className="py-2 px-3">
                    <div>
                      <p className={`text-sm font-medium leading-tight ${
                        isCanceled
                          ? 'text-red-700 dark:text-red-300 line-through'
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {job.year} {job.make} {job.model}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {job.plateNumber && (
                          <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                            {job.plateNumber}
                          </span>
                        )}
                        {job.vin && (
                          <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 truncate max-w-[100px]" title={job.vin}>
                            VIN: {job.vin}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* 5. Customer */}
                  <td className="py-2 px-3">
                    <div>
                      <p className="text-sm text-gray-900 dark:text-white font-medium truncate max-w-[140px]">
                        {job.customerName}
                      </p>
                      {job.phoneNumber && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          {job.phoneNumber}
                        </p>
                      )}
                    </div>
                  </td>

                  {/* 6. Mechanic */}
                  <td className="py-2 px-3">
                    {job.assignedMechanic ? (() => {
                      const mechStatus = getMechanicWorkStatus(job.assignedMechanic, allJobs);
                      const isDualTask = mechStatus.activeJobs.length > 1;
                      return (
                        <div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                            {getMechanicDisplay(job.assignedMechanic, mechanics)}
                            {isDualTask && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400" title={`Assigned to ${mechStatus.activeJobs.length} active jobs`}>
                                <Layers className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </p>
                          {job.assistantMechanic && (
                            <p className="text-[10px] text-gray-400 dark:text-gray-500">
                              + {getMechanicDisplay(job.assistantMechanic, mechanics)}
                            </p>
                          )}
                        </div>
                      );
                    })() : !isCanceled ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                        <AlertTriangle className="w-3 h-3" />
                        Unassigned
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>

                  {/* 7. Service Started */}
                  <td className="py-2 px-3">
                    {job.serviceStartedAt ? (
                      <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {job.serviceStartedAt}
                      </p>
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>

                  {/* 8. Service Done */}
                  <td className="py-2 px-3">
                    {serviceDone ? (
                      <p className={`text-xs whitespace-nowrap ${
                        isCanceled
                          ? 'text-red-600 dark:text-red-400 font-medium'
                          : 'text-teal-700 dark:text-teal-300 font-medium'
                      }`}>
                        {serviceDone}
                      </p>
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>

                  {/* 9. Actions */}
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-center gap-1">
                      {/* Edit */}
                      {!isLocked && (
                        <button
                          onClick={() => setEditingJobId(job.id)}
                          title="Edit job"
                          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Cancel — only WAITLIST non-cancelled */}
                      {isWaitlist && !isCanceled && (
                        <button
                          onClick={() => setCancelingJobId(job.id)}
                          title="Cancel this intake"
                          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-red-100/60 dark:hover:bg-red-950/40 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Done / Paid — IN_SERVICE, AWAITING_PARTS, READY_FOR_PICKUP */}
                      {canDonePaid && (
                        <button
                          onClick={() => handleDonePaidClick(job)}
                          onBlur={() => { if (isConfirmingDonePaid) setConfirmDonePaidId(null); }}
                          title={isConfirmingDonePaid ? `Confirm: Mark #${job.queueNumber} as Done and Paid?` : 'Mark as Done / Paid'}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap ${
                            isConfirmingDonePaid
                              ? 'bg-emerald-700 text-white hover:bg-emerald-800 ring-2 ring-emerald-300 dark:ring-emerald-600'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {isConfirmingDonePaid ? 'Confirm?' : 'Done / Paid'}
                        </button>
                      )}

                      {/* Dash for fully locked items with no actions */}
                      {isLocked && !isWaitlist && !canDonePaid && (
                        <span className="text-[10px] text-gray-300 dark:text-gray-600 px-1">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Showing {startIdx + 1}–{Math.min(startIdx + ROWS_PER_PAGE, sortedJobs.length)} of{' '}
            <span className="font-semibold text-gray-700 dark:text-gray-300">{sortedJobs.length}</span> jobs
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Single page job count */}
      {totalPages === 1 && (
        <div className="mt-3 px-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-gray-700 dark:text-gray-300">{sortedJobs.length}</span> job{sortedJobs.length !== 1 ? 's' : ''} total
          </p>
        </div>
      )}

      {/* Quick View Modal */}
      {quickViewJob && (
        <QuickViewModal job={quickViewJob} onClose={() => setQuickViewJob(null)} />
      )}
    </div>
  );
}
