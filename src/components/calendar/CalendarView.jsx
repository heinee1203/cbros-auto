import { useState, useMemo, useEffect, useRef } from 'react';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfDay,
  eachDayOfInterval,
  format,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isBefore,
  isToday,
  isSameDay,
  isSameMonth,
  addDays,
  getDay,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
  Wrench,
  User,
  CalendarDays,
  LayoutGrid,
  Save,
  Plus,
  Lock,
} from 'lucide-react';
import { useJobsStore } from '../../stores/jobsStore';
import { useUIStore } from '../../stores/uiStore';
import { useAdminStore, getMechanicDisplay } from '../../stores/adminStore';

export default function CalendarView() {
  const mechanics = useAdminStore((s) => s.mechanics);
  const slotCapacity = useAdminStore((s) => s.slotCapacity);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date()); // default to today
  const [viewMode, setViewMode] = useState('week'); // 'week' or 'month'
  const jobs = useJobsStore((s) => s.jobs);
  const getAllMechanicLoadsForDate = useJobsStore((s) => s.getAllMechanicLoadsForDate);
  const updateJob = useJobsStore((s) => s.updateJob);
  const closedDates = useJobsStore((s) => s.closedDates);
  const setEditingJobId = useUIStore((s) => s.setEditingJobId);
  const openIntakeModal = useUIStore((s) => s.openIntakeModal);

  // Real-time clock for past-slot filtering (ticks every minute)
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Inline editing state
  const [editingInline, setEditingInline] = useState(null);

  // Compute days based on view mode
  const { days, label } = useMemo(() => {
    if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return {
        days: eachDayOfInterval({ start: weekStart, end: weekEnd }),
        label: `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`,
      };
    } else {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return {
        days: eachDayOfInterval({ start: calStart, end: calEnd }),
        label: format(currentDate, 'MMMM yyyy'),
      };
    }
  }, [currentDate, viewMode]);

  const jobsByDay = useMemo(() => {
    const map = {};
    days.forEach((day) => {
      const dateStr = format(day, 'MM/dd/yyyy');
      map[dateStr] = jobs.filter((j) => j.appointmentDate === dateStr);
    });
    return map;
  }, [jobs, days]);

  const selectedDateStr = selectedDate ? format(selectedDate, 'MM/dd/yyyy') : null;
  const selectedDateISO = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const selectedJobs = selectedDateStr
    ? jobs.filter((j) => j.appointmentDate === selectedDateStr)
    : [];
  const selectedLoads = selectedDateStr
    ? getAllMechanicLoadsForDate(selectedDateStr)
    : {};

  // Past-date read-only check
  const isPastDate = selectedDate ? isBefore(startOfDay(selectedDate), startOfDay(new Date())) : false;
  // Is the selected day today? (for past-slot time filtering)
  const isSelectedDateToday = selectedDate ? isToday(selectedDate) : false;

  // Closed-date check: date was formally closed out via EOD, or Sunday after noon
  const isSundayAfterNoon = isSelectedDateToday && getDay(now) === 0 && now.getHours() >= 12;
  const isClosedDate = selectedDateStr ? (closedDates.includes(selectedDateStr) || isSundayAfterNoon) : false;

  // Auto-redirect: when today is closed or Sunday afternoon, redirect to next available date
  const lastRedirectRef = useRef('');
  useEffect(() => {
    const realNow = new Date();
    const todayStr = format(realNow, 'MM/dd/yyyy');
    const isTodayClosed = closedDates.includes(todayStr);
    const isSundayPM = getDay(realNow) === 0 && realNow.getHours() >= 12;

    if (!(isTodayClosed || isSundayPM)) return;
    if (!isSameDay(selectedDate, realNow)) return;

    // Use a key to only redirect once per trigger
    const key = isTodayClosed ? `closed:${todayStr}` : `sun:${todayStr}`;
    if (lastRedirectRef.current === key) return;
    lastRedirectRef.current = key;

    // Find next available date (skip closed dates)
    let next = addDays(realNow, 1);
    for (let i = 0; i < 30; i++) {
      if (!closedDates.includes(format(next, 'MM/dd/yyyy'))) break;
      next = addDays(next, 1);
    }
    setSelectedDate(next);
    setCurrentDate(next);
  }, [closedDates, now, selectedDate]);

  const navigate = (dir) => {
    if (viewMode === 'week') {
      setCurrentDate(dir === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    } else {
      setCurrentDate(dir === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    }
  };

  const handleInlineSave = (jobId) => {
    if (!editingInline || editingInline.jobId !== jobId) return;
    const updates = {};
    if (editingInline.mechanic !== undefined) updates.assignedMechanic = editingInline.mechanic;
    if (editingInline.hours !== undefined) {
      updates.estimatedManHours = editingInline.hours ? parseFloat(editingInline.hours) : null;
    }
    updateJob(jobId, updates);
    setEditingInline(null);
  };

  // Click on available slot to open intake with pre-filled time
  const handleSlotClick = (slotTime, count, isPastSlot) => {
    if (isPastDate) return; // Past dates are read-only
    if (isClosedDate) return; // Closed dates are locked
    if (isPastSlot) return; // Past time slots on today are not clickable
    if (count >= slotCapacity) return; // Don't open for full slots
    if (!selectedDateISO) return;
    openIntakeModal({
      appointmentDate: selectedDateISO,
      preferredTime: slotTime,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header: nav + view toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('prev')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>

        <div className="flex items-center gap-4">
          <div className="text-center">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{label}</h3>
            <button
              onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Today
            </button>
          </div>

          {/* View mode toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'week'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <CalendarDays className="w-3 h-3" />
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'month'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              Month
            </button>
          </div>
        </div>

        <button
          onClick={() => navigate('next')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Day headers for month view */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-7 gap-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 py-1">
              {d}
            </div>
          ))}
        </div>
      )}

      {/* Day grid */}
      <div className={`grid gap-${viewMode === 'week' ? '2' : '1'} ${
        viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-7'
      }`}>
        {days.map((day) => {
          const dateStr = format(day, 'MM/dd/yyyy');
          const dayJobs = jobsByDay[dateStr] || [];
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const today = isToday(day);
          const loads = getAllMechanicLoadsForDate(dateStr);
          const hasOverload = Object.values(loads).some((h) => h > 8);
          const inMonth = viewMode === 'month' ? isSameMonth(day, currentDate) : true;

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(day)}
              className={`relative rounded-lg border text-left transition-all ${
                viewMode === 'week' ? 'p-3' : 'p-1.5 min-h-[70px]'
              } ${
                !inMonth ? 'opacity-40' : ''
              } ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 ring-2 ring-blue-500/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-xs font-medium ${
                  today ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {viewMode === 'week' ? format(day, 'EEE') : ''}
                </span>
                {hasOverload && <AlertTriangle className="w-3 h-3 text-red-500" />}
              </div>
              <p className={`font-bold ${viewMode === 'week' ? 'text-lg' : 'text-sm'} ${
                today ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
              }`}>
                {format(day, 'd')}
              </p>
              {dayJobs.length > 0 && (
                <span className={`inline-block text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded ${
                  viewMode === 'week' ? 'mt-1' : 'mt-0.5'
                }`}>
                  {dayJobs.length}
                </span>
              )}
              {closedDates.includes(dateStr) && (
                <span className={`inline-block text-[9px] font-bold text-red-600 dark:text-red-400 ${viewMode === 'week' ? 'mt-0.5' : 'mt-0'}`}>
                  Closed
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-fade-in">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            {format(selectedDate, 'EEEE, MM/dd/yyyy')}
            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
              {selectedJobs.length} scheduled job{selectedJobs.length !== 1 ? 's' : ''}
            </span>
            {(isPastDate || isClosedDate) && (
              <span className="ml-auto flex items-center gap-1.5">
                {isPastDate && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 rounded-full border border-amber-200 dark:border-amber-800">
                    <Lock className="w-3 h-3" />
                    Read-Only
                  </span>
                )}
                {isClosedDate && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40 rounded-full border border-red-200 dark:border-red-800">
                    <Lock className="w-3 h-3" />
                    Day Closed
                  </span>
                )}
              </span>
            )}
          </h4>

          {/* Mechanic loads for this day */}
          {Object.keys(selectedLoads).length > 0 && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Mechanic Load
              </h5>
              <div className="flex flex-wrap gap-2">
                {Object.entries(selectedLoads).map(([mech, hours]) => (
                  <span
                    key={mech}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                      hours > 8
                        ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                        : hours > 6
                        ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                        : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                    }`}
                  >
                    <Wrench className="w-3 h-3" />
                    {getMechanicDisplay(mech, mechanics)}: {hours}h
                    {hours > 8 && <AlertTriangle className="w-3 h-3" />}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 30-minute Time Slot Grid */}
          <div className="mb-4">
            <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Daily Schedule — 30-Min Slots (max {slotCapacity} per slot)
            </h5>
            <div className="grid grid-cols-1 gap-0.5">
              {Array.from({ length: 18 }, (_, i) => {
                const hour = 8 + Math.floor(i / 2);
                const min = i % 2 === 0 ? '00' : '30';
                const slotTime = `${String(hour).padStart(2, '0')}:${min}`;
                const h12 = hour > 12 ? hour - 12 : hour;
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const slotLabel = `${h12}:${min} ${ampm}`;
                const bookedJobs = selectedJobs.filter((j) => j.preferredTime === slotTime);
                const count = bookedJobs.length;
                const isFull = count >= slotCapacity;
                const isBooked = count > 0;

                // Past-time check: slot's 30-min window has fully elapsed on today
                const slotEndMinutes = hour * 60 + parseInt(min) + 30;
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                const isPastSlot = isSelectedDateToday && slotEndMinutes <= currentMinutes;

                return (
                  <div
                    key={slotTime}
                    className={`flex items-center gap-3 px-3 py-1.5 rounded text-xs transition-colors ${
                      isPastSlot
                        ? 'bg-gray-100 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-700 opacity-50'
                        : isFull
                        ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'
                        : isBooked
                        ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800'
                        : 'bg-gray-50 dark:bg-gray-900/50 border border-transparent hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer'
                    }`}
                    title={isPastSlot ? 'Time has passed' : undefined}
                    onClick={() => !isFull && !isBooked && !isPastSlot && handleSlotClick(slotTime, count, false)}
                  >
                    <span className={`w-20 font-mono font-medium shrink-0 ${
                      isPastSlot ? 'text-gray-400 dark:text-gray-500 line-through' :
                      isFull ? 'text-red-700 dark:text-red-300' :
                      isBooked ? 'text-blue-700 dark:text-blue-300' : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {slotLabel}
                    </span>

                    {/* Capacity indicator */}
                    <span className={`text-[10px] font-mono shrink-0 ${
                      isPastSlot ? 'text-gray-300 dark:text-gray-600' :
                      isFull ? 'text-red-500 dark:text-red-400 font-bold' :
                      isBooked ? 'text-blue-500 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'
                    }`}>
                      {count}/{slotCapacity}
                    </span>

                    {isPastSlot ? (
                      isBooked ? (
                        <div className="flex-1 flex flex-wrap gap-1.5">
                          {bookedJobs.map((bj) => (
                            <button
                              key={bj.id}
                              onClick={(e) => { e.stopPropagation(); setEditingJobId(bj.id); }}
                              className="inline-flex items-center gap-1.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                              {bj.queueNumber && (
                                <span className="font-mono text-[10px] font-bold">#{bj.queueNumber}</span>
                              )}
                              {bj.year} {bj.make} {bj.model}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">Time has passed</span>
                      )
                    ) : isFull ? (
                      <div className="flex-1 flex items-center gap-1.5">
                        <span className="text-red-600 dark:text-red-400 font-bold text-[10px] uppercase">Full</span>
                        <div className="flex flex-wrap gap-1">
                          {bookedJobs.map((bj) => (
                            <button
                              key={bj.id}
                              onClick={(e) => { e.stopPropagation(); setEditingJobId(bj.id); }}
                              className="inline-flex items-center gap-1 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 px-1.5 py-0.5 rounded-full text-[10px] font-medium hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                            >
                              {bj.queueNumber && <span className="font-mono font-bold">#{bj.queueNumber}</span>}
                              {bj.make} {bj.model}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : isBooked ? (
                      <div className="flex-1 flex flex-wrap gap-1.5">
                        {bookedJobs.map((bj) => (
                          <button
                            key={bj.id}
                            onClick={(e) => { e.stopPropagation(); setEditingJobId(bj.id); }}
                            className="inline-flex items-center gap-1.5 bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                          >
                            {bj.queueNumber && (
                              <span className="font-mono text-[10px] font-bold">#{bj.queueNumber}</span>
                            )}
                            {bj.year} {bj.make} {bj.model}
                            {bj.assignedMechanic && (
                              <span className="text-blue-600 dark:text-blue-300">
                                — {getMechanicDisplay(bj.assignedMechanic, mechanics)}
                              </span>
                            )}
                          </button>
                        ))}
                        {/* Add button for partially-filled slots (hidden for past dates, past time slots, closed dates) */}
                        {!isPastDate && !isClosedDate && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSlotClick(slotTime, count, false); }}
                            className="inline-flex items-center gap-0.5 text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-1.5 py-0.5 rounded-full text-[10px] font-medium hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            Add
                          </button>
                        )}
                      </div>
                    ) : (isPastDate || isClosedDate) ? (
                      <span className="text-xs text-gray-300 dark:text-gray-600">
                        {isClosedDate && !isPastDate ? 'Day Closed' : '—'}
                      </span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSlotClick(slotTime, count, false); }}
                        className="flex items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span className="text-xs">Available — Click to add</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unscheduled jobs (no preferred time) */}
          {selectedJobs.filter((j) => !j.preferredTime).length > 0 && (
            <div className="mb-4">
              <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                No Time Specified
              </h5>
              <div className="space-y-1.5">
                {selectedJobs.filter((j) => !j.preferredTime).map((job) => {
                  const isEditing = editingInline?.jobId === job.id;

                  return (
                    <div
                      key={job.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditingJobId(job.id)}>
                        <div className="flex items-center gap-2 mb-0.5">
                          {job.queueNumber && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-blue-600 dark:bg-blue-500 text-white px-1.5 py-0.5 rounded font-mono">
                              #{job.queueNumber}
                            </span>
                          )}
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {job.year} {job.make} {job.model}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                          <User className="w-3 h-3" />{job.customerName}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {(isPastDate || isClosedDate) ? (
                          <>
                            {job.assignedMechanic && (
                              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                                {getMechanicDisplay(job.assignedMechanic, mechanics)}
                              </span>
                            )}
                            {job.estimatedManHours && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {job.estimatedManHours}h
                              </span>
                            )}
                          </>
                        ) : isEditing ? (
                          <>
                            <select
                              value={editingInline.mechanic ?? job.assignedMechanic ?? ''}
                              onChange={(e) => setEditingInline((s) => ({ ...s, mechanic: e.target.value }))}
                              className="text-xs px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            >
                              <option value="">Unassigned</option>
                              {mechanics.map((m) => (
                                <option key={m.id} value={m.name}>{getMechanicDisplay(m)}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={editingInline.hours ?? job.estimatedManHours ?? ''}
                              onChange={(e) => setEditingInline((s) => ({ ...s, hours: e.target.value }))}
                              placeholder="hrs"
                              className="w-14 text-xs px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                            <button
                              onClick={() => handleInlineSave(job.id)}
                              className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                              title="Save"
                            >
                              <Save className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <>
                            {job.assignedMechanic ? (
                              <button
                                onClick={() => setEditingInline({ jobId: job.id, mechanic: job.assignedMechanic, hours: job.estimatedManHours || '' })}
                                className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              >
                                {getMechanicDisplay(job.assignedMechanic, mechanics)}
                              </button>
                            ) : (
                              <button
                                onClick={() => setEditingInline({ jobId: job.id, mechanic: '', hours: job.estimatedManHours || '' })}
                                className="text-xs text-red-500 flex items-center gap-1 hover:text-red-600 transition-colors"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                Assign
                              </button>
                            )}
                            {job.estimatedManHours && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {job.estimatedManHours}h
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
