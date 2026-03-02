import { useState, useEffect } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  User,
  Wrench,
  Package,
  Clock,
  AlertTriangle,
  Calendar,
  GripVertical,
  Hash,
  MapPin,
  DollarSign,
  Play,
  CheckCircle2,
  XCircle,
  Ban,
} from 'lucide-react';
import { useJobsStore, to12Hour } from '../../stores/jobsStore';
import { useUIStore } from '../../stores/uiStore';
import { JOB_STATUSES, STATUS_ORDER } from '../../data/rosters';
import { useAdminStore, getMechanicDisplay } from '../../stores/adminStore';

export default function JobCard({ job, onDragStart, onDragEnd, isDragging, forceCollapsed }) {
  const { moveJobForward, moveJobBackward, togglePartsOrdered, assignMechanic, togglePaid, toggleDone, clearBay, setJobStatus } =
    useJobsStore();
  const setEditingJobId = useUIStore((s) => s.setEditingJobId);
  const setBayAssignmentPending = useUIStore((s) => s.setBayAssignmentPending);
  const setCancelingJobId = useUIStore((s) => s.setCancelingJobId);
  const mechanics = useAdminStore((s) => s.mechanics);
  const allBays = useAdminStore((s) => s.getAllBays)();

  // Auto-minimize when in Ready for Pickup or Done
  const [localCollapsed, setLocalCollapsed] = useState(
    job.status === JOB_STATUSES.READY_FOR_PICKUP || job.status === JOB_STATUSES.DONE
  );

  // When job moves to READY_FOR_PICKUP or DONE, auto-minimize
  useEffect(() => {
    if (job.status === JOB_STATUSES.READY_FOR_PICKUP || job.status === JOB_STATUSES.DONE) {
      setLocalCollapsed(true);
    }
  }, [job.status]);

  // Global override takes precedence, but local toggle can break out
  const collapsed = forceCollapsed != null ? forceCollapsed : localCollapsed;

  const statusIdx = STATUS_ORDER.indexOf(job.status);
  const canMoveForward = statusIdx < STATUS_ORDER.length - 1;
  const canMoveBackward = statusIdx > 0;
  const needsMechanic = !job.assignedMechanic;
  const isReadyForPickup = job.status === JOB_STATUSES.READY_FOR_PICKUP;
  const isDoneStatus = job.status === JOB_STATUSES.DONE;
  const isCanceled = !!job.isCanceled;
  const isLocked = isCanceled || isDoneStatus || (isReadyForPickup && (job.isPaid || job.isDone));
  const showToggles = !isCanceled && (isReadyForPickup || isDoneStatus);
  const isInService = job.status === JOB_STATUSES.IN_SERVICE;
  const isAwaitingParts = job.status === JOB_STATUSES.AWAITING_PARTS;
  const isWaitlist = job.status === JOB_STATUSES.WAITLIST;

  const bayLabel = job.assignedBay
    ? allBays.find((b) => b.id === job.assignedBay)?.label || job.assignedBay
    : null;

  // Handle forward move with bay assignment interception
  const handleMoveForward = () => {
    if (isLocked) return;
    const nextStatus = STATUS_ORDER[statusIdx + 1];
    if (!nextStatus) return;

    // If moving INTO In-Service or Awaiting Parts and no bay assigned, require bay assignment
    if (
      (nextStatus === JOB_STATUSES.IN_SERVICE || nextStatus === JOB_STATUSES.AWAITING_PARTS) &&
      !job.assignedBay
    ) {
      setBayAssignmentPending({ jobId: job.id, targetStatus: nextStatus });
      return;
    }

    // If moving to Ready for Pickup, clear the bay
    if (nextStatus === JOB_STATUSES.READY_FOR_PICKUP && job.assignedBay) {
      clearBay(job.id);
    }

    setJobStatus(job.id, nextStatus);
  };

  // Handle backward move with bay clearing
  const handleMoveBackward = () => {
    if (isLocked) return;
    const prevStatus = STATUS_ORDER[statusIdx - 1];
    if (!prevStatus) return;

    // If moving INTO In-Service or Awaiting Parts (backward) and no bay, require bay assignment
    if (
      (prevStatus === JOB_STATUSES.IN_SERVICE || prevStatus === JOB_STATUSES.AWAITING_PARTS) &&
      !job.assignedBay
    ) {
      setBayAssignmentPending({ jobId: job.id, targetStatus: prevStatus });
      return;
    }

    // If moving back to Waitlist, clear the bay
    if (prevStatus === JOB_STATUSES.WAITLIST && job.assignedBay) {
      clearBay(job.id);
    }

    setJobStatus(job.id, prevStatus);
  };

  return (
    <div className="flex flex-col">
      <div
        id={`job-card-${job.id}`}
        draggable={!isLocked}
        onDragStart={(e) => {
          if (isLocked) { e.preventDefault(); return; }
          onDragStart?.(e, job.id);
        }}
        onDragEnd={onDragEnd}
        className={`group rounded-lg border p-3 transition-all ${
          isLocked
            ? 'cursor-not-allowed opacity-75'
            : 'cursor-grab active:cursor-grabbing hover:shadow-md'
        } ${
          isDragging ? 'opacity-40 scale-95' : ''
        } ${
          isCanceled
            ? 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/30'
            : isLocked
            ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
            : job.partsOrdered
            ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/30'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
        }`}
        onClick={() => { if (!isLocked) setEditingJobId(job.id); }}
      >
        {/* Top row: Queue Number + badges + Collapse toggle */}
        <div className="flex items-center gap-1.5 mb-1.5">
          {job.queueNumber && (
            <span className="inline-flex items-center gap-1 text-xs font-bold bg-blue-600 dark:bg-blue-500 text-white px-2 py-0.5 rounded-md font-mono tracking-wide">
              <Hash className="w-3 h-3" />
              {job.queueNumber}
            </span>
          )}
          {job.partsOrdered && (
            <span className="shrink-0 flex items-center gap-1 text-xs font-medium bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full">
              <Package className="w-3 h-3" />
              Parts
            </span>
          )}
          {(isInService || isAwaitingParts) && bayLabel && (
            <span className="shrink-0 flex items-center gap-1 text-xs font-medium bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full">
              <MapPin className="w-3 h-3" />
              {bayLabel}
            </span>
          )}
          {needsMechanic && !isLocked && (
            <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
              <AlertTriangle className="w-2.5 h-2.5" />
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              const next = !collapsed;
              setLocalCollapsed(next);
              // Break out of global override so individual toggle works
              if (forceCollapsed != null) {
                useUIStore.getState().setAllCardsCollapsed(null);
              }
            }}
            className="ml-auto p-0.5 rounded transition-colors text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            title={collapsed ? 'Expand card' : 'Minimize card'}
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Vehicle title (always visible) + Plate + Odometer */}
        <div className="flex items-start gap-1.5">
          {!isLocked && (
            <GripVertical className="w-3.5 h-3.5 mt-0.5 text-gray-300 dark:text-gray-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 dark:text-white leading-tight">
              {job.year} {job.make} {job.model}
            </p>
            <div className="flex items-center gap-2">
              {job.plateNumber && (
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {job.plateNumber}
                </span>
              )}
              {job.odometerReading && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  ODO: {job.odometerReading} km
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Intake date + timestamp (always visible, shown together) */}
        {(job.dateReceived || job.intakeTimestamp) && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 ml-5">
            Intake: {job.dateReceived}{job.intakeTimestamp ? ` at ${job.intakeTimestamp}` : ''}
          </p>
        )}

        {/* Timestamps only when NOT collapsed */}
        {!collapsed && (
          <>
            {/* Service Started timestamp (date + time) */}
            {job.serviceStartedAt && (
              <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-0.5 ml-5 flex items-center gap-1">
                <Play className="w-2.5 h-2.5" />
                Started: {job.serviceStartedAt}
              </p>
            )}

            {/* Ready for Pickup timestamp */}
            {job.readyForPickupAt && (isReadyForPickup || isDoneStatus) && (
              <p className="text-[10px] text-emerald-500 dark:text-emerald-400 mt-0.5 ml-5 flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Ready at {job.readyForPickupAt}
              </p>
            )}
          </>
        )}

        {/* Expanded content */}
        {!collapsed && (
          <>
            {/* Customer */}
            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 mb-1 ml-5 mt-1.5">
              <User className="w-3 h-3" />
              {job.customerName}
            </div>

            {/* Mechanic */}
            <div className="flex items-center gap-1.5 text-xs mb-1 ml-5">
              <Wrench className="w-3 h-3 text-gray-500" />
              {needsMechanic ? (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  Needs Mechanic
                </span>
              ) : (
                <span className="text-gray-600 dark:text-gray-400">
                  {getMechanicDisplay(job.assignedMechanic, mechanics)}
                  {job.assistantMechanic && (
                    <span className="text-gray-400 dark:text-gray-500"> + {getMechanicDisplay(job.assistantMechanic, mechanics)}</span>
                  )}
                </span>
              )}
            </div>

            {/* Front desk */}
            <div className="text-xs text-gray-500 dark:text-gray-500 mb-1 ml-5">
              FD: {job.frontDeskLead}
            </div>

            {/* Services summary */}
            {job.reasonForVisit && (
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1 ml-5">
                {Array.isArray(job.reasonForVisit) ? (
                  job.reasonForVisit.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {job.reasonForVisit.slice(0, 3).map((svc) => (
                        <span key={svc} className="inline-block px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-medium text-gray-600 dark:text-gray-300">
                          {svc}
                        </span>
                      ))}
                      {job.reasonForVisit.length > 3 && (
                        <span className="inline-block px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 rounded text-[10px] font-medium text-blue-600 dark:text-blue-300">
                          +{job.reasonForVisit.length - 3} more
                        </span>
                      )}
                    </div>
                  )
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">{job.reasonForVisit}</span>
                )}
              </div>
            )}

            {/* Appointment date + preferred time (12-hour format) */}
            {(job.appointmentDate || job.preferredTime) && (
              <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 mb-1 ml-5">
                <Calendar className="w-3 h-3" />
                {job.appointmentDate || 'No date'}
                {job.preferredTime && (
                  <span className="text-blue-500 dark:text-blue-300 font-medium">
                    @ {to12Hour(job.preferredTime)}
                  </span>
                )}
              </div>
            )}

            {/* Man hours + Est completion (12-hour format) */}
            {(job.estimatedManHours || job.estimatedCompletion) && (
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-2 ml-5">
                {job.estimatedManHours && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {job.estimatedManHours}h est.
                  </span>
                )}
                {job.estimatedCompletion && (
                  <span className="text-gray-400 dark:text-gray-500">
                    ETC: {to12Hour(job.estimatedCompletion)}
                  </span>
                )}
              </div>
            )}

            {/* PAID + DONE toggles — Ready for Pickup and Done columns */}
            {showToggles && (
              <div className="space-y-1.5 mb-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" />
                    PAID
                  </span>
                  <button
                    onClick={() => togglePaid(job.id)}
                    disabled={job.isDone}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      job.isPaid ? 'bg-emerald-500' : job.isDone ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        job.isPaid ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    DONE
                    <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500">(No fee)</span>
                  </span>
                  <button
                    onClick={() => toggleDone(job.id)}
                    disabled={job.isPaid}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      job.isDone ? 'bg-sky-500' : job.isPaid ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        job.isDone ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* Quick actions */}
            {!isLocked && (
              <div
                className="flex items-center gap-1 pt-2 border-t border-gray-100 dark:border-gray-700"
                onClick={(e) => e.stopPropagation()}
                onDragStart={(e) => e.stopPropagation()}
                draggable={false}
              >
                {needsMechanic && (
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) assignMechanic(job.id, e.target.value);
                    }}
                    className="text-xs px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Assign...</option>
                    {mechanics.map((m) => (
                      <option key={m.id} value={m.name}>
                        {getMechanicDisplay(m)}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={() => togglePartsOrdered(job.id)}
                  title={job.partsOrdered ? 'Parts received' : 'Order parts'}
                  className={`p-1 rounded text-xs transition-colors ${
                    job.partsOrdered
                      ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                </button>

                {isWaitlist && (
                  <button
                    onClick={() => setCancelingJobId(job.id)}
                    title="Cancel this intake"
                    className="p-1 rounded bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                )}

                <div className="ml-auto flex gap-1">
                  {canMoveBackward && (
                    <button
                      onClick={handleMoveBackward}
                      title="Move to previous stage"
                      className="p-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canMoveForward && (
                    <button
                      onClick={handleMoveForward}
                      title="Move to next stage"
                      className="p-1 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Paid / Done / Cancelled timestamp below the card */}
      {isCanceled && job.canceledAt && (
        <p className="text-center text-[10px] font-bold text-red-600 dark:text-red-400 mt-1">
          Cancelled at {job.canceledAt}
        </p>
      )}
      {!isCanceled && (isReadyForPickup || isDoneStatus) && job.isPaid && job.paidAt && (
        <p className="text-center text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mt-1">
          Paid at {job.paidAt}
        </p>
      )}
      {!isCanceled && (isReadyForPickup || isDoneStatus) && job.isDone && job.doneAt && !job.isPaid && (
        <p className="text-center text-[10px] font-medium text-sky-600 dark:text-sky-400 mt-1">
          Done at {job.doneAt}
        </p>
      )}
    </div>
  );
}
