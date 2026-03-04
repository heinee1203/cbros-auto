import { useEffect } from 'react';
import {
  X,
  Hash,
  User,
  Wrench,
  Package,
  Clock,
  AlertTriangle,
  Calendar,
  MapPin,
  DollarSign,
  Play,
  CheckCircle2,
  Ban,
  Layers,
  History,
} from 'lucide-react';
import { useJobsStore, to12Hour, getMechanicWorkStatus } from '../../stores/jobsStore';
import { useUIStore } from '../../stores/uiStore';
import { useAdminStore, getMechanicDisplay } from '../../stores/adminStore';
import { JOB_STATUSES, STATUS_LABELS } from '../../data/rosters';

// Status badge color map (same as JobListView)
const STATUS_BADGE_COLORS = {
  [JOB_STATUSES.WAITLIST]: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  [JOB_STATUSES.IN_SERVICE]: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  [JOB_STATUSES.AWAITING_PARTS]: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
  [JOB_STATUSES.READY_FOR_PICKUP]: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
  [JOB_STATUSES.DONE]: 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300',
};

export default function QuickViewModal({ job, onClose }) {
  const mechanics = useAdminStore((s) => s.mechanics);
  const allBays = useAdminStore((s) => s.getAllBays)();
  const allJobs = useJobsStore((s) => s.jobs);
  const openVehicleHistory = useUIStore((s) => s.openVehicleHistory);

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const isCanceled = !!job.isCanceled;
  const isReadyForPickup = job.status === JOB_STATUSES.READY_FOR_PICKUP;
  const isDoneStatus = job.status === JOB_STATUSES.DONE;
  const isInService = job.status === JOB_STATUSES.IN_SERVICE;
  const isAwaitingParts = job.status === JOB_STATUSES.AWAITING_PARTS;
  const needsMechanic = !job.assignedMechanic;

  // Dual-task detection
  const leadMechanicStatus = job.assignedMechanic ? getMechanicWorkStatus(job.assignedMechanic, allJobs) : null;
  const isLeadDualTask = leadMechanicStatus && leadMechanicStatus.activeJobs.length > 1;

  const bayLabel = job.assignedBay
    ? allBays.find((b) => b.id === job.assignedBay)?.label || job.assignedBay
    : null;

  const getStatusBadge = () => {
    if (isCanceled) {
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

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Dimmed overlay */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Modal panel */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {job.queueNumber && (
              <span className="inline-flex items-center gap-1 text-xs font-bold bg-blue-600 dark:bg-blue-500 text-white px-2 py-0.5 rounded-md font-mono tracking-wide">
                <Hash className="w-3 h-3" />
                {job.queueNumber}
              </span>
            )}
            {getStatusBadge()}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-5 space-y-4">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5">
            {job.partsOrdered && (
              <span className="shrink-0 flex items-center gap-1 text-xs font-medium bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full">
                <Package className="w-3 h-3" />
                Parts Ordered
              </span>
            )}
            {(isInService || isAwaitingParts) && bayLabel && (
              <span className="shrink-0 flex items-center gap-1 text-xs font-medium bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full">
                <MapPin className="w-3 h-3" />
                {bayLabel}
              </span>
            )}
            {(isReadyForPickup || isDoneStatus) && job.isPaid && (
              <span className="shrink-0 flex items-center gap-1 text-xs font-bold bg-emerald-600 dark:bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                <DollarSign className="w-3 h-3" />
                PAID
              </span>
            )}
            {(isReadyForPickup || isDoneStatus) && job.isDone && !job.isPaid && !isCanceled && (
              <span className="shrink-0 flex items-center gap-1 text-xs font-bold bg-sky-600 dark:bg-sky-500 text-white px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                DONE
              </span>
            )}
            {isCanceled && (
              <span className="shrink-0 flex items-center gap-1 text-xs font-bold bg-red-600 dark:bg-red-500 text-white px-2 py-0.5 rounded-full">
                <Ban className="w-3 h-3" />
                CANCELLED
              </span>
            )}
          </div>

          {/* Vehicle info */}
          <div>
            <p className="font-semibold text-base text-gray-900 dark:text-white leading-tight">
              {job.year} {job.make} {job.model}
            </p>
            <div className="flex items-center gap-3 mt-1">
              {job.plateNumber && (
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                  {job.plateNumber}
                </span>
              )}
              {job.odometerReading && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  ODO: {job.odometerReading} km
                </span>
              )}
              {job.vin && (
                <span className="text-xs font-mono text-gray-400 dark:text-gray-500 truncate max-w-[140px]" title={job.vin}>
                  VIN: {job.vin}
                </span>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 space-y-1.5">
            {(job.dateReceived || job.intakeTimestamp) && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Intake: {job.dateReceived}{job.intakeTimestamp ? ` at ${job.intakeTimestamp}` : ''}
              </p>
            )}
            {job.serviceStartedAt && (
              <p className="text-xs text-blue-500 dark:text-blue-400 flex items-center gap-1">
                <Play className="w-3 h-3" />
                Started: {job.serviceStartedAt}
              </p>
            )}
            {job.readyForPickupAt && (isReadyForPickup || isDoneStatus) && (
              <p className="text-xs text-emerald-500 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Ready at {job.readyForPickupAt}
              </p>
            )}
            {isCanceled && job.canceledAt && (
              <p className="text-xs font-bold text-red-600 dark:text-red-400">
                Cancelled at {job.canceledAt}
              </p>
            )}
            {!isCanceled && job.isPaid && job.paidAt && (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Paid at {job.paidAt}
              </p>
            )}
            {!isCanceled && job.isDone && job.doneAt && !job.isPaid && (
              <p className="text-xs font-medium text-sky-600 dark:text-sky-400">
                Done at {job.doneAt}
              </p>
            )}
          </div>

          {/* Personnel */}
          <div className="space-y-2">
            {/* Customer */}
            {job.customerName && (
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="truncate">{job.customerName}</span>
                {job.phoneNumber && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    ({job.phoneNumber})
                  </span>
                )}
              </div>
            )}

            {/* Mechanic */}
            <div className="flex items-center gap-2 text-sm">
              <Wrench className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              {needsMechanic && !isCanceled ? (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  Needs Mechanic
                </span>
              ) : job.assignedMechanic ? (
                <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1 flex-wrap">
                  {getMechanicDisplay(job.assignedMechanic, mechanics)}
                  {isLeadDualTask && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400" title={`Assigned to ${leadMechanicStatus.activeJobs.length} active jobs`}>
                      <Layers className="w-2.5 h-2.5" />
                    </span>
                  )}
                  {job.assistantMechanic && (
                    <span className="text-gray-400 dark:text-gray-500">
                      + {getMechanicDisplay(job.assistantMechanic, mechanics)}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
              )}
            </div>

            {/* Front desk */}
            {job.frontDeskLead && (
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500 ml-5.5">
                FD: {job.frontDeskLead}
              </div>
            )}
          </div>

          {/* Services — show ALL (no truncation) */}
          {job.reasonForVisit && Array.isArray(job.reasonForVisit) && job.reasonForVisit.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Services</p>
              <div className="flex flex-wrap gap-1">
                {job.reasonForVisit.map((svc) => (
                  <span
                    key={svc}
                    className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-medium text-gray-600 dark:text-gray-300"
                  >
                    {svc}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Scheduling & Estimates */}
          {(job.appointmentDate || job.preferredTime || job.estimatedManHours || job.estimatedCompletion) && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              {(job.appointmentDate || job.preferredTime) && (
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <Calendar className="w-3 h-3" />
                  {job.appointmentDate || 'No date'}
                  {job.preferredTime && (
                    <span className="font-medium"> @ {to12Hour(job.preferredTime)}</span>
                  )}
                </span>
              )}
              {job.estimatedManHours && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {job.estimatedManHours}h est.
                </span>
              )}
              {job.estimatedCompletion && (
                <span>ETC: {to12Hour(job.estimatedCompletion)}</span>
              )}
            </div>
          )}

          {/* Internal Notes */}
          {job.internalNotes && (
            <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
              <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400 mb-0.5">Notes</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400/80 leading-relaxed whitespace-pre-wrap">
                {job.internalNotes}
              </p>
            </div>
          )}

          {/* View History link */}
          {job.plateNumber && (
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  openVehicleHistory(job.plateNumber);
                  onClose();
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                View Vehicle History
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
