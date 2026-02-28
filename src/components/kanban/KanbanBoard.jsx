import { useMemo, useState, useCallback, useEffect } from 'react';
import { ClipboardList, Settings, Package, CheckCircle2, GripVertical, MapPin, X, Users, Gauge, ChevronsUp, Car, Wrench, Hash, Minimize2, Maximize2, ChevronsDownUp, ChevronsUpDown, Play, User, BadgeCheck, AlertTriangle } from 'lucide-react';
import { useJobsStore, getJobMechanics, isMechanicOnJob } from '../../stores/jobsStore';
import { useUIStore } from '../../stores/uiStore';
import { JOB_STATUSES, STATUS_LABELS } from '../../data/rosters';
import { useAdminStore } from '../../stores/adminStore';
import JobCard from '../jobs/JobCard';

const COLUMN_CONFIG = [
  { status: JOB_STATUSES.WAITLIST, icon: ClipboardList, color: 'text-slate-600 dark:text-slate-300', headerBg: 'bg-slate-100 dark:bg-slate-800', colBg: 'bg-slate-50/50 dark:bg-slate-800/30', accent: 'border-t-slate-400 dark:border-t-slate-500' },
  { status: JOB_STATUSES.IN_SERVICE, icon: Settings, color: 'text-blue-600 dark:text-blue-400', headerBg: 'bg-blue-50 dark:bg-blue-950/40', colBg: 'bg-blue-50/30 dark:bg-blue-950/10', accent: 'border-t-blue-500 dark:border-t-blue-400' },
  { status: JOB_STATUSES.AWAITING_PARTS, icon: Package, color: 'text-amber-600 dark:text-amber-400', headerBg: 'bg-amber-50 dark:bg-amber-950/40', colBg: 'bg-amber-50/30 dark:bg-amber-950/10', accent: 'border-t-amber-500 dark:border-t-amber-400' },
  { status: JOB_STATUSES.READY_FOR_PICKUP, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', headerBg: 'bg-emerald-50 dark:bg-emerald-950/40', colBg: 'bg-emerald-50/30 dark:bg-emerald-950/10', accent: 'border-t-emerald-500 dark:border-t-emerald-400' },
  { status: JOB_STATUSES.DONE, icon: BadgeCheck, color: 'text-teal-600 dark:text-teal-400', headerBg: 'bg-teal-50 dark:bg-teal-950/40', colBg: 'bg-teal-50/30 dark:bg-teal-950/10', accent: 'border-t-teal-500 dark:border-t-teal-400' },
];

export default function KanbanBoard() {
  const jobs = useJobsStore((s) => s.jobs);
  const setJobStatus = useJobsStore((s) => s.setJobStatus);
  const mechanics = useAdminStore((s) => s.mechanics);
  const getLifterBays = useAdminStore((s) => s.getLifterBays);
  const getNonLifterBays = useAdminStore((s) => s.getNonLifterBays);
  const getAllBays = useAdminStore((s) => s.getAllBays);
  const LIFTER_BAYS = getLifterBays();
  const NON_LIFTER_BAYS = getNonLifterBays();
  const ALL_BAYS = getAllBays();
  const assignBay = useJobsStore((s) => s.assignBay);
  const clearBay = useJobsStore((s) => s.clearBay);
  const assignMechanic = useJobsStore((s) => s.assignMechanic);
  const assignAssistantMechanic = useJobsStore((s) => s.assignAssistantMechanic);
  const { searchQuery, filterUnassigned, filterPartsOrdered, filterFrontDesk, filterMechanic, bayMapView, allCardsCollapsed } = useUIStore();
  const toggleBayMapView = useUIStore((s) => s.toggleBayMapView);
  const setAllCardsCollapsed = useUIStore((s) => s.setAllCardsCollapsed);

  // Listen for bay assignment requests from JobCard arrow buttons (via uiStore)
  const bayAssignmentPending = useUIStore((s) => s.bayAssignmentPending);
  const clearBayAssignment = useUIStore((s) => s.clearBayAssignment);

  const [draggedJobId, setDraggedJobId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [dragOverBay, setDragOverBay] = useState(null);
  const [dropSuccessBay, setDropSuccessBay] = useState(null);
  const [draggedFromBay, setDraggedFromBay] = useState(null);

  // "Start Service & Assignment" modal state
  const [serviceModal, setServiceModal] = useState(null);
  // { jobId, targetStatus, selectedBay, leadMechanic, helperMechanic }

  const openServiceModal = useCallback((jobId, targetStatus, preSelectedBay = null) => {
    const job = jobs.find((j) => j.id === jobId);
    setServiceModal({
      jobId,
      targetStatus,
      selectedBay: preSelectedBay || job?.assignedBay || null,
      leadMechanic: job?.assignedMechanic || '',
      helperMechanic: job?.assistantMechanic || '',
    });
  }, [jobs]);

  // When bayAssignmentPending is set from JobCard, open the service modal
  useEffect(() => {
    if (bayAssignmentPending) {
      openServiceModal(bayAssignmentPending.jobId, bayAssignmentPending.targetStatus);
      clearBayAssignment();
    }
  }, [bayAssignmentPending, clearBayAssignment, openServiceModal]);

  const filteredJobs = useMemo(() => {
    let result = [...jobs];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (j) =>
          j.customerName.toLowerCase().includes(q) ||
          j.plateNumber?.toLowerCase().includes(q) ||
          j.vin?.toLowerCase().includes(q) ||
          j.make.toLowerCase().includes(q) ||
          j.model.toLowerCase().includes(q) ||
          j.queueNumber?.toLowerCase().includes(q)
      );
    }
    if (filterUnassigned) {
      result = result.filter((j) => !j.assignedMechanic);
    }
    if (filterPartsOrdered) {
      result = result.filter((j) => j.partsOrdered);
    }
    if (filterFrontDesk) {
      result = result.filter((j) => j.frontDeskLead === filterFrontDesk);
    }
    if (filterMechanic) {
      result = result.filter((j) => j.assignedMechanic === filterMechanic || j.assistantMechanic === filterMechanic);
    }
    return result;
  }, [jobs, searchQuery, filterUnassigned, filterPartsOrdered, filterFrontDesk, filterMechanic]);

  const jobsByStatus = useMemo(() => {
    const grouped = {};
    Object.values(JOB_STATUSES).forEach((s) => (grouped[s] = []));
    filteredJobs.forEach((j) => {
      if (grouped[j.status]) grouped[j.status].push(j);
    });

    // Waitlist: FIFO sort
    if (grouped[JOB_STATUSES.WAITLIST]) {
      grouped[JOB_STATUSES.WAITLIST].sort((a, b) => {
        const aHasAppt = !!a.appointmentDate;
        const bHasAppt = !!b.appointmentDate;
        if (aHasAppt && !bHasAppt) return -1;
        if (!aHasAppt && bHasAppt) return 1;
        if (aHasAppt && bHasAppt) {
          const [aM, aD, aY] = a.appointmentDate.split('/');
          const [bM, bD, bY] = b.appointmentDate.split('/');
          const aDateNum = parseInt(aY + aM + aD, 10);
          const bDateNum = parseInt(bY + bM + bD, 10);
          if (aDateNum !== bDateNum) return aDateNum - bDateNum;
          const aTime = a.preferredTime || '99:99';
          const bTime = b.preferredTime || '99:99';
          if (aTime !== bTime) return aTime.localeCompare(bTime);
        }
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
    }

    Object.keys(grouped).forEach((s) => {
      if (s !== JOB_STATUSES.WAITLIST) {
        grouped[s].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    });

    return grouped;
  }, [filteredJobs]);

  // Occupied bays — includes both In-Service and Awaiting Parts jobs with bays
  const occupiedBays = useMemo(() => {
    const map = {};
    jobs.forEach((j) => {
      if (
        (j.status === JOB_STATUSES.IN_SERVICE || j.status === JOB_STATUSES.AWAITING_PARTS) &&
        j.assignedBay
      ) {
        map[j.assignedBay] = j;
      }
    });
    return map;
  }, [jobs]);

  // Available bays
  const availableBays = useMemo(
    () => ALL_BAYS.filter((b) => !occupiedBays[b.id]),
    [occupiedBays]
  );

  // Bay occupancy counts by type
  const lifterOccupied = useMemo(
    () => LIFTER_BAYS.filter((b) => occupiedBays[b.id]).length,
    [occupiedBays]
  );
  const nonLifterOccupied = useMemo(
    () => NON_LIFTER_BAYS.filter((b) => occupiedBays[b.id]).length,
    [occupiedBays]
  );

  // --- Live Floor Metrics ---
  const metrics = useMemo(() => {
    const waitlistCount = jobs.filter((j) => j.status === JOB_STATUSES.WAITLIST).length;
    const activeServiceCount = jobs.filter((j) => j.status === JOB_STATUSES.IN_SERVICE).length;

    // Mechanics assigned to active bays (In-Service or Awaiting Parts with a bay)
    const busyMechanics = new Set();
    jobs.forEach((j) => {
      if (
        (j.status === JOB_STATUSES.IN_SERVICE || j.status === JOB_STATUSES.AWAITING_PARTS) &&
        j.assignedBay &&
        j.assignedMechanic
      ) {
        busyMechanics.add(j.assignedMechanic);
      }
    });
    const availableMechanicsCount = mechanics.length - busyMechanics.size;

    return { waitlistCount, activeServiceCount, availableMechanicsCount };
  }, [jobs]);

  // Mechanic load data for the Live Floor — total hours per mechanic across all active jobs
  const mechanicLoadBars = useMemo(() => {
    const loads = {};
    mechanics.forEach((m) => { loads[m.name] = { hours: 0, jobs: 0 }; });
    jobs.forEach((j) => {
      if (!j.estimatedManHours) return;
      const hours = j.estimatedManHours || 0;
      if (j.assignedMechanic && loads[j.assignedMechanic]) {
        loads[j.assignedMechanic].hours += hours;
        loads[j.assignedMechanic].jobs += 1;
      }
      if (j.assistantMechanic && loads[j.assistantMechanic]) {
        loads[j.assistantMechanic].hours += hours;
        loads[j.assistantMechanic].jobs += 1;
      }
    });
    return mechanics.map((m) => ({
      name: m.name,
      shortName: m.shortName,
      ...loads[m.name],
    })).filter((m) => m.hours > 0 || m.jobs > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [jobs]);

  // Drag handlers
  const handleDragStart = useCallback((e, jobId) => {
    // Don't allow dragging locked (paid) jobs
    const job = jobs.find((j) => j.id === jobId);
    if (job?.isPaid && job?.status === JOB_STATUSES.READY_FOR_PICKUP) {
      e.preventDefault();
      return;
    }
    setDraggedJobId(jobId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', jobId);
    requestAnimationFrame(() => {
      const el = document.getElementById(`job-card-${jobId}`);
      if (el) el.classList.add('dragging-card');
    });
  }, [jobs]);

  const handleDragEnd = useCallback(() => {
    if (draggedJobId) {
      const el = document.getElementById(`job-card-${draggedJobId}`);
      if (el) el.classList.remove('dragging-card');
    }
    setDraggedJobId(null);
    setDragOverColumn(null);
    setDragOverBay(null);
    setDraggedFromBay(null);
  }, [draggedJobId]);

  const handleDragOver = useCallback((e, status) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  }, []);

  const handleDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverColumn(null);
    }
  }, []);

  const handleDrop = useCallback((e, targetStatus) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData('text/plain');
    if (!jobId || !targetStatus) return;

    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    // Intercept In-Service drops — always open "Start Service & Assignment" modal
    if (targetStatus === JOB_STATUSES.IN_SERVICE) {
      openServiceModal(jobId, targetStatus);
    } else if (targetStatus === JOB_STATUSES.AWAITING_PARTS && !job.assignedBay) {
      // Awaiting Parts without a bay — also open service modal
      openServiceModal(jobId, targetStatus);
    } else if (targetStatus === JOB_STATUSES.READY_FOR_PICKUP || targetStatus === JOB_STATUSES.WAITLIST) {
      // Moving to Ready for Pickup or back to Waitlist — clear the bay
      if (job.assignedBay) {
        clearBay(jobId);
      }
      setJobStatus(jobId, targetStatus);
    } else {
      setJobStatus(jobId, targetStatus);
    }

    setDraggedJobId(null);
    setDragOverColumn(null);
  }, [jobs, setJobStatus, clearBay, openServiceModal]);

  // Bay map drag-and-drop: drop a job card directly onto a bay
  const handleBayDragOver = useCallback((e, bayId) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (!occupiedBays[bayId]) {
      setDragOverBay(bayId);
    }
  }, [occupiedBays]);

  const handleBayDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverBay(null);
    }
  }, []);

  const handleBayDrop = useCallback((e, bayId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverBay(null);

    if (occupiedBays[bayId]) return; // bay is full

    const jobId = e.dataTransfer.getData('text/plain');
    if (!jobId) return;

    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    // Bay-to-bay reassignment: just move the bay, keep current status
    if (job.assignedBay) {
      assignBay(jobId, bayId);
    } else {
      // New bay assignment from kanban card — open service modal with pre-selected bay
      openServiceModal(jobId, JOB_STATUSES.IN_SERVICE, bayId);
      setDraggedJobId(null);
      setDragOverColumn(null);
      setDraggedFromBay(null);
      return; // skip animation — modal handles the rest
    }

    // Trigger drop success animation
    setDropSuccessBay(bayId);
    setTimeout(() => setDropSuccessBay(null), 700);

    setDraggedJobId(null);
    setDragOverColumn(null);
    setDraggedFromBay(null);
  }, [jobs, occupiedBays, assignBay, setJobStatus, openServiceModal]);

  // Bay-to-bay drag: start dragging an occupied bay cell
  const handleBayCellDragStart = useCallback((e, bayId) => {
    const job = occupiedBays[bayId];
    if (!job) { e.preventDefault(); return; }

    setDraggedJobId(job.id);
    setDraggedFromBay(bayId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', job.id);
  }, [occupiedBays]);

  const handleServiceConfirm = () => {
    if (!serviceModal) return;
    const { jobId, targetStatus, selectedBay, leadMechanic, helperMechanic } = serviceModal;
    if (!selectedBay || !leadMechanic) return; // required fields

    assignBay(jobId, selectedBay);
    assignMechanic(jobId, leadMechanic);
    assignAssistantMechanic(jobId, helperMechanic || '');
    setJobStatus(jobId, targetStatus);

    // Trigger drop success animation on the assigned bay
    setDropSuccessBay(selectedBay);
    setTimeout(() => setDropSuccessBay(null), 700);

    setServiceModal(null);
  };

  // Check if a bay's job is dimmed by active filters
  const isBayDimmed = useCallback((job) => {
    if (!job) return false;
    if (filterFrontDesk && job.frontDeskLead !== filterFrontDesk) return true;
    if (filterMechanic && job.assignedMechanic !== filterMechanic && job.assistantMechanic !== filterMechanic) return true;
    return false;
  }, [filterFrontDesk, filterMechanic]);

  // Helper to render an enhanced bay cell (maximalist)
  const renderBayCell = (bay) => {
    const job = occupiedBays[bay.id];
    const isDragTarget = dragOverBay === bay.id && !job && draggedJobId;
    const isDropSuccess = dropSuccessBay === bay.id;
    const isLifter = bay.type === 'lifter';
    const BayIcon = isLifter ? ChevronsUp : Car;
    const mechanics = job ? getJobMechanics(job) : [];
    const isDragSource = draggedFromBay === bay.id;
    const dimmed = job && isBayDimmed(job);

    return (
      <div
        key={bay.id}
        draggable={!!job}
        onDragStart={(e) => job ? handleBayCellDragStart(e, bay.id) : e.preventDefault()}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => handleBayDragOver(e, bay.id)}
        onDragLeave={handleBayDragLeave}
        onDrop={(e) => handleBayDrop(e, bay.id)}
        className={`relative p-3 xl:p-4 rounded-xl text-center min-h-[130px] xl:min-h-[150px] border-2 transition-all duration-200 flex flex-col items-center justify-center select-none ${
          isDragSource
            ? 'opacity-40 border-dashed border-gray-400 dark:border-gray-500 bg-gray-100 dark:bg-gray-800'
            : isDropSuccess
            ? 'bay-cell-drop-success border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
            : isDragTarget
            ? 'bay-cell-drop-active'
            : job
            ? `${isLifter
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600'
                : 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-700 hover:border-violet-300 dark:hover:border-violet-600'
              } ${dimmed ? 'opacity-40' : ''}`
            : 'bg-gray-50/80 dark:bg-gray-900/40 border-dashed border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        } ${job ? 'cursor-grab active:cursor-grabbing' : ''}`}
        title={job ? `${job.make} ${job.model} | ${job.plateNumber || 'No plate'} — ${job.customerName} (Drag to reassign bay)` : 'Available — Drop a job here'}
      >
        {/* Bay header with icon */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <BayIcon className={`w-5 h-5 ${
            job
              ? isLifter ? 'text-blue-500 dark:text-blue-400' : 'text-violet-500 dark:text-violet-400'
              : 'text-gray-300 dark:text-gray-600'
          }`} />
          <span className={`text-sm font-bold ${
            job
              ? isLifter ? 'text-blue-700 dark:text-blue-300' : 'text-violet-700 dark:text-violet-300'
              : 'text-gray-400 dark:text-gray-500'
          }`}>
            {bay.label}
          </span>
        </div>

        {job ? (
          <>
            {job.queueNumber && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold bg-blue-600 dark:bg-blue-500 text-white px-2 py-0.5 rounded font-mono mb-1">
                <Hash className="w-3 h-3" />
                {job.queueNumber}
              </span>
            )}
            <p className="text-sm xl:text-base font-bold text-gray-900 dark:text-white leading-tight">
              {job.make} {job.model}
            </p>
            <p className="text-xs xl:text-sm font-mono font-semibold text-gray-600 dark:text-gray-300 mt-0.5">
              {job.plateNumber || '—'}
            </p>
            {mechanics.length > 0 && (
              <div className="flex items-center gap-1 mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                <Wrench className="w-3 h-3 shrink-0" />
                <span className="truncate">{mechanics.join(' & ')}</span>
              </div>
            )}
          </>
        ) : isDragTarget ? (
          <div className="flex flex-col items-center gap-1 bay-drop-hint-bounce">
            <MapPin className="w-7 h-7 text-blue-400 dark:text-blue-300" />
            <p className="text-sm font-bold text-blue-500 dark:text-blue-400">Drop Here</p>
          </div>
        ) : (
          <p className="text-lg xl:text-xl font-bold text-gray-200 dark:text-gray-700 uppercase tracking-widest">
            AVAILABLE
          </p>
        )}
      </div>
    );
  };

  // Helper to render a minimalist bay chip (occupied only)
  const renderMiniBayChip = (bay) => {
    const job = occupiedBays[bay.id];
    if (!job) return null;
    const isLifter = bay.type === 'lifter';
    const BayIcon = isLifter ? ChevronsUp : Car;
    const dimmed = isBayDimmed(job);
    const isDragSource = draggedFromBay === bay.id;

    return (
      <div
        key={bay.id}
        draggable
        onDragStart={(e) => handleBayCellDragStart(e, bay.id)}
        onDragEnd={handleDragEnd}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-grab active:cursor-grabbing transition-all ${
          isDragSource
            ? 'opacity-40 border-dashed border-gray-400'
            : isLifter
            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200'
            : 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-700 text-violet-800 dark:text-violet-200'
        } ${dimmed ? 'opacity-40' : ''}`}
        title={`${job.make} ${job.model} — Drag to reassign`}
      >
        <BayIcon className={`w-3.5 h-3.5 ${isLifter ? 'text-blue-500' : 'text-violet-500'}`} />
        <span className="font-bold">{bay.label.replace('Lifter ', 'L').replace('Non-Lifter ', 'NL')}</span>
        <span className="font-medium">{job.make} {job.model}</span>
        {job.plateNumber && <span className="font-mono text-gray-500 dark:text-gray-400">{job.plateNumber}</span>}
      </div>
    );
  };

  return (
    <div>
      {/* Live Floor Metrics */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
            <ClipboardList className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Queue Length</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">{metrics.waitlistCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40">
            <Gauge className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Active Services</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">{metrics.activeServiceCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
            <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Available Mechanics</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
              {metrics.availableMechanicsCount}
              <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-1">/ {mechanics.length}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Mechanic Load — Visual progress bars */}
      {mechanicLoadBars.length > 0 && (
        <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Mechanic Load</h4>
            <div className="ml-auto flex items-center gap-3 text-[9px] font-semibold">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />0-5h</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />5-8h</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />8h+</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {mechanicLoadBars.map((m) => {
              const pct = Math.min((m.hours / 10) * 100, 100);
              const barColor = m.hours >= 8
                ? 'bg-red-500 dark:bg-red-400'
                : m.hours >= 5
                ? 'bg-amber-500 dark:bg-amber-400'
                : 'bg-emerald-500 dark:bg-emerald-400';
              const textColor = m.hours >= 8
                ? 'text-red-600 dark:text-red-400'
                : m.hours >= 5
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400';
              return (
                <div key={m.name} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 truncate">{m.shortName}</span>
                      <span className={`text-[10px] font-bold ${textColor}`}>
                        {m.hours.toFixed(1)}h
                        {m.hours >= 8 && <AlertTriangle className="w-2.5 h-2.5 inline ml-0.5 -mt-0.5" />}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">{m.jobs} job{m.jobs !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Floor Bay Map — Full Width, proper document flow (no sticky) */}
      <div className="mb-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 xl:p-5 shadow-sm">
        {/* Header with Minimalist/Maximalist toggle */}
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/40">
            <MapPin className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
              Live Floor Bay Map
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {Object.keys(occupiedBays).length} / {ALL_BAYS.length} bays occupied
            </p>
          </div>
          {draggedJobId && (
            <span className="flex items-center gap-2 text-sm text-blue-500 dark:text-blue-400 font-semibold animate-pulse bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 rounded-lg">
              <MapPin className="w-4 h-4" />
              Drop card on an open bay to assign
            </span>
          )}
          {/* Minimalist / Maximalist toggle */}
          <button
            onClick={toggleBayMapView}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
            title={bayMapView === 'max' ? 'Switch to minimalist view' : 'Switch to full view'}
          >
            {bayMapView === 'max' ? (
              <><Minimize2 className="w-3.5 h-3.5" /> Minimalist</>
            ) : (
              <><Maximize2 className="w-3.5 h-3.5" /> Maximalist</>
            )}
          </button>
        </div>

        {bayMapView === 'max' ? (
          /* ---- MAXIMALIST VIEW ---- */
          <>
            {/* Lifter Bays Section */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <ChevronsUp className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                <h4 className="text-sm font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  Lifter Bays
                </h4>
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-900/50 px-2 py-0.5 rounded-full">
                  {lifterOccupied} / {LIFTER_BAYS.length}
                </span>
              </div>
              <div className="grid grid-cols-3 lg:grid-cols-7 gap-3">
                {LIFTER_BAYS.map((bay) => renderBayCell(bay))}
              </div>
            </div>

            {/* Non-Lifter Bays Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Car className="w-5 h-5 text-violet-500 dark:text-violet-400" />
                <h4 className="text-sm font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wide">
                  Non-Lifter Bays
                </h4>
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-900/50 px-2 py-0.5 rounded-full">
                  {nonLifterOccupied} / {NON_LIFTER_BAYS.length}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {NON_LIFTER_BAYS.map((bay) => renderBayCell(bay))}
              </div>
            </div>
          </>
        ) : (
          /* ---- MINIMALIST VIEW ---- */
          <div>
            {/* Occupied bay chips */}
            <div className="flex flex-wrap gap-2">
              {ALL_BAYS.map((bay) => renderMiniBayChip(bay))}
              {Object.keys(occupiedBays).length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-1">All bays empty</p>
              )}
            </div>
            {/* Compact drop targets for available bays */}
            {availableBays.length > 0 && draggedJobId && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 self-center mr-1 font-medium uppercase">Drop targets:</span>
                {availableBays.map((bay) => {
                  const isDragTarget = dragOverBay === bay.id;
                  return (
                    <div
                      key={bay.id}
                      onDragOver={(e) => handleBayDragOver(e, bay.id)}
                      onDragLeave={handleBayDragLeave}
                      onDrop={(e) => handleBayDrop(e, bay.id)}
                      className={`px-2 py-1 rounded text-[10px] font-medium border border-dashed transition-all ${
                        isDragTarget
                          ? 'bay-cell-drop-active border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300'
                          : 'border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900/40'
                      }`}
                    >
                      {bay.label.replace('Lifter ', 'L').replace('Non-Lifter ', 'NL')}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters bar */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <FilterButton
          label="Unassigned"
          active={filterUnassigned}
          onClick={() => useUIStore.getState().setFilterUnassigned(!filterUnassigned)}
        />
        <FilterButton
          label="Parts Ordered"
          active={filterPartsOrdered}
          onClick={() => useUIStore.getState().setFilterPartsOrdered(!filterPartsOrdered)}
        />

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

        {/* Expand All / Collapse All toggle */}
        <button
          onClick={() => setAllCardsCollapsed(allCardsCollapsed === true ? false : true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            allCardsCollapsed != null
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
          title={allCardsCollapsed === true ? 'Expand all cards' : 'Collapse all cards'}
        >
          {allCardsCollapsed === true ? (
            <><ChevronsUpDown className="w-3.5 h-3.5" /> Expand All</>
          ) : (
            <><ChevronsDownUp className="w-3.5 h-3.5" /> Collapse All</>
          )}
        </button>

        {allCardsCollapsed != null && (
          <button
            onClick={() => setAllCardsCollapsed(null)}
            className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 underline"
          >
            Reset
          </button>
        )}

        {draggedJobId && (
          <span className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium animate-fade-in">
            <GripVertical className="w-3.5 h-3.5" />
            Drop on a column or bay to move
          </span>
        )}
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
          {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {COLUMN_CONFIG.map(({ status, icon: Icon, color, headerBg, colBg, accent }) => {
          const colJobs = jobsByStatus[status] || [];
          const isDropTarget = dragOverColumn === status && draggedJobId;

          return (
            <div
              key={status}
              className="flex flex-col"
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-t-lg border-t-2 ${accent} ${headerBg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
                <h3 className={`text-sm font-bold ${color}`}>
                  {STATUS_LABELS[status]}
                </h3>
                <span className="ml-auto text-xs font-semibold text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-gray-900/80 px-2 py-0.5 rounded-full min-w-[24px] text-center">
                  {colJobs.length}
                </span>
              </div>
              <div
                className={`flex-1 min-h-[200px] rounded-b-lg border border-t-0 border-gray-200 dark:border-gray-700 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-380px)] transition-colors ${colBg} ${
                  isDropTarget ? 'kanban-column-drop-active' : ''
                }`}
              >
                {colJobs.length === 0 ? (
                  <div className={`flex flex-col items-center justify-center py-10 ${isDropTarget ? 'opacity-100' : 'opacity-60'}`}>
                    {isDropTarget ? (
                      <p className="text-sm text-blue-500 dark:text-blue-400 font-medium">
                        Drop here
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        No jobs
                      </p>
                    )}
                  </div>
                ) : (
                  colJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      isDragging={draggedJobId === job.id}
                      forceCollapsed={allCardsCollapsed}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Start Service & Assignment Modal */}
      {serviceModal && (() => {
        const modalJob = jobs.find((j) => j.id === serviceModal.jobId);
        const isConfirmDisabled = !serviceModal.selectedBay || !serviceModal.leadMechanic;

        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setServiceModal(null)} />
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl mx-4 p-6 animate-slide-in max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                    <Play className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  Start Service & Assignment
                </h3>
                <button
                  onClick={() => setServiceModal(null)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Job info summary */}
              {modalJob && (
                <div className="mb-5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 flex items-center gap-3 flex-wrap">
                  {modalJob.queueNumber && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded font-mono">
                      <Hash className="w-3 h-3" />{modalJob.queueNumber}
                    </span>
                  )}
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {modalJob.year} {modalJob.make} {modalJob.model}
                  </span>
                  {modalJob.plateNumber && (
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{modalJob.plateNumber}</span>
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{modalJob.customerName}</span>
                </div>
              )}

              {/* Section 1: Bay Assignment (Required) */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-violet-500" />
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">Bay Assignment</h4>
                  <span className="text-[10px] font-medium text-red-500 uppercase">Required</span>
                </div>

                {availableBays.length === 0 && !serviceModal.selectedBay ? (
                  <p className="text-sm text-red-500 text-center py-4 font-medium">No bays available. All bays are occupied.</p>
                ) : (
                  <>
                    {/* Lifter Bays */}
                    <div className="mb-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <ChevronsUp className="w-4 h-4 text-blue-500" />
                        <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Lifter Bays</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {LIFTER_BAYS.map((bay) => {
                          const isOccupiedByOther = occupiedBays[bay.id] && occupiedBays[bay.id].id !== serviceModal.jobId;
                          const isAvailable = !isOccupiedByOther;
                          const isSelected = serviceModal.selectedBay === bay.id;
                          const occupant = occupiedBays[bay.id];
                          return (
                            <button
                              key={bay.id}
                              disabled={!isAvailable}
                              onClick={() => setServiceModal((prev) => ({ ...prev, selectedBay: bay.id }))}
                              className={`p-2.5 rounded-xl text-sm font-medium text-center border-2 transition-all ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600 text-white ring-2 ring-blue-300 dark:ring-blue-500 scale-[1.02]'
                                  : isAvailable
                                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                                  : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1.5">
                                <ChevronsUp className="w-4 h-4" />
                                <span className="font-bold">{bay.label}</span>
                              </div>
                              {isSelected ? (
                                <p className="text-[10px] mt-0.5 opacity-80">✓ Selected</p>
                              ) : isAvailable ? (
                                <p className="text-[10px] mt-0.5 text-blue-500 dark:text-blue-400">Available</p>
                              ) : (
                                <p className="text-[10px] mt-0.5 truncate">{occupant?.make} {occupant?.model}</p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Non-Lifter Bays */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Car className="w-4 h-4 text-violet-500" />
                        <p className="text-xs font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wide">Non-Lifter Bays</p>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {NON_LIFTER_BAYS.map((bay) => {
                          const isOccupiedByOther = occupiedBays[bay.id] && occupiedBays[bay.id].id !== serviceModal.jobId;
                          const isAvailable = !isOccupiedByOther;
                          const isSelected = serviceModal.selectedBay === bay.id;
                          const occupant = occupiedBays[bay.id];
                          return (
                            <button
                              key={bay.id}
                              disabled={!isAvailable}
                              onClick={() => setServiceModal((prev) => ({ ...prev, selectedBay: bay.id }))}
                              className={`p-2 rounded-xl text-xs font-medium text-center border-2 transition-all ${
                                isSelected
                                  ? 'bg-violet-600 border-violet-600 text-white ring-2 ring-violet-300 dark:ring-violet-500 scale-[1.02]'
                                  : isAvailable
                                  ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50 hover:border-violet-400 dark:hover:border-violet-500 cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                                  : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1">
                                <Car className="w-3.5 h-3.5" />
                                <span className="font-bold">{bay.label.replace('Non-Lifter ', 'NL')}</span>
                              </div>
                              {isSelected ? (
                                <p className="text-[10px] mt-0.5 opacity-80">✓ Selected</p>
                              ) : isAvailable ? (
                                <p className="text-[10px] mt-0.5 text-violet-500 dark:text-violet-400">Available</p>
                              ) : (
                                <p className="text-[10px] mt-0.5 truncate">{occupant?.make} {occupant?.model}</p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Section 2: Mechanic Assignment */}
              <div className="mb-5 grid grid-cols-2 gap-4">
                {/* Lead Mechanic (Required) */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-blue-500" />
                    <label className="text-sm font-bold text-gray-900 dark:text-white">Lead Mechanic</label>
                    <span className="text-[10px] font-medium text-red-500 uppercase">Required</span>
                  </div>
                  <select
                    value={serviceModal.leadMechanic}
                    onChange={(e) => {
                      const newLead = e.target.value;
                      setServiceModal((prev) => ({
                        ...prev,
                        leadMechanic: newLead,
                        // Auto-clear helper if it matches the new lead
                        helperMechanic: prev.helperMechanic === newLead ? '' : prev.helperMechanic,
                      }));
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border-2 text-sm font-medium bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  >
                    <option value="">— Select Lead —</option>
                    {mechanics.map((m) => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>

                {/* Helper Mechanic (Optional) */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-emerald-500" />
                    <label className="text-sm font-bold text-gray-900 dark:text-white">Helper Mechanic</label>
                    <span className="text-[10px] font-medium text-gray-400 uppercase">Optional</span>
                  </div>
                  <select
                    value={serviceModal.helperMechanic}
                    onChange={(e) => setServiceModal((prev) => ({ ...prev, helperMechanic: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border-2 text-sm font-medium bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-colors"
                  >
                    <option value="">— None —</option>
                    {mechanics.filter((m) => m.name !== serviceModal.leadMechanic).map((m) => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Validation hint */}
              {isConfirmDisabled && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400 font-medium">
                  {!serviceModal.selectedBay && !serviceModal.leadMechanic
                    ? 'Select a bay and lead mechanic to continue.'
                    : !serviceModal.selectedBay
                    ? 'Select a bay to continue.'
                    : 'Select a lead mechanic to continue.'}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setServiceModal(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={isConfirmDisabled}
                  onClick={handleServiceConfirm}
                  className={`flex-1 px-4 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                    isConfirmDisabled
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl active:scale-[0.98]'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  Start Service
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function FilterButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
      }`}
    >
      {label}
    </button>
  );
}
