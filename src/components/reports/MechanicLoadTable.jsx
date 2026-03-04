import { useState, useMemo } from 'react';
import {
  format,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  subMonths,
  addMonths,
} from 'date-fns';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Wrench,
  CheckCircle2,
  ClipboardList,
  Package,
  UserX,
  CalendarDays,
  Trophy,
  Filter,
  X,
  Clock,
} from 'lucide-react';
import { useJobsStore, to12Hour, isMechanicOnJob } from '../../stores/jobsStore';
import { useAdminStore, getMechanicDisplay } from '../../stores/adminStore';
import { JOB_STATUSES } from '../../data/rosters';

/**
 * Parse a timestamp like "03/04/2026 at 09:15 AM" into a Date object.
 * Returns null if the string is missing or unparseable.
 */
const parseTimestamp = (str) => {
  if (!str) return null;
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i);
  if (!m) return null;
  let hours = parseInt(m[4], 10);
  const mins = parseInt(m[5], 10);
  const ampm = m[6].toUpperCase();
  if (ampm === 'PM' && hours !== 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return new Date(parseInt(m[3], 10), parseInt(m[1], 10) - 1, parseInt(m[2], 10), hours, mins);
};

/**
 * Extract just the date portion "MM/dd/yyyy" from a full timestamp string.
 */
const extractDateFromTimestamp = (str) => {
  if (!str) return null;
  const m = str.match(/^(\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : null;
};

/**
 * Determine if a job is "completed" (service work is done).
 * Ready for Pickup, Done, or Done+Paid all count.
 */
const isJobCompleted = (j) =>
  j.status === JOB_STATUSES.READY_FOR_PICKUP || j.status === JOB_STATUSES.DONE;

/**
 * Calculate actual hours worked from serviceDoneTime - serviceStartedAt.
 * Returns null if either timestamp is missing/unparseable.
 */
const calcActualHours = (j) => {
  const start = parseTimestamp(j.serviceStartedAt);
  const end = parseTimestamp(j.serviceDoneTime);
  if (!start || !end) return null;
  const diffMs = end - start;
  if (diffMs <= 0) return null;
  return Math.round((diffMs / 3600000) * 10) / 10; // round to 1 decimal
};

/**
 * Get effective hours for a job:
 * - Completed jobs with timestamps → actual hours (serviceDone - serviceStart)
 * - Falls back to estimatedManHours
 */
const getJobHours = (j) => {
  if (isJobCompleted(j)) {
    const actual = calcActualHours(j);
    if (actual !== null) return actual;
  }
  return j.estimatedManHours || 0;
};

export default function MechanicLoadTable() {
  const [weekOffset, setWeekOffset] = useState(0);
  const jobs = useJobsStore((s) => s.jobs);
  const mechanics = useAdminStore((s) => s.mechanics);

  // Calendar state for date range filtering
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  // Week navigation
  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7), {
    weekStartsOn: 1,
  });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Week presets for quick selector
  const weekPresets = useMemo(() => {
    const presets = [];
    for (let i = -4; i <= 4; i++) {
      const ws = startOfWeek(addDays(new Date(), i * 7), { weekStartsOn: 1 });
      const we = endOfWeek(ws, { weekStartsOn: 1 });
      let label;
      if (i === 0) label = 'This Week';
      else if (i === -1) label = 'Last Week';
      else if (i === 1) label = 'Next Week';
      else label = `${format(ws, 'MMM d')} - ${format(we, 'MMM d')}`;
      presets.push({ offset: i, label, ws, we });
    }
    return presets;
  }, []);

  // Mechanic load data for the week view (heatmap)
  // Includes completed jobs (Done/Ready for Pickup) with actual hours calculated
  const loadData = useMemo(() => {
    return mechanics.map((mech) => {
      const dailyLoads = days.map((day) => {
        const dateStr = format(day, 'MM/dd/yyyy');
        const mechJobs = jobs.filter((j) => {
          if (j.isCanceled) return false;
          if (!isMechanicOnJob(j, mech.name)) return false;
          // Match by appointment date, received date, or service activity date
          if (j.appointmentDate === dateStr) return true;
          if (!j.appointmentDate && j.dateReceived === dateStr) return true;
          // Also include completed jobs whose service was done on this date
          if (isJobCompleted(j) && extractDateFromTimestamp(j.serviceDoneTime) === dateStr) return true;
          if (extractDateFromTimestamp(j.serviceStartedAt) === dateStr) return true;
          return false;
        });
        // De-duplicate (a job might match on multiple criteria)
        const unique = [...new Map(mechJobs.map((j) => [j.id, j])).values()];
        const total = unique.reduce((s, j) => s + getJobHours(j), 0);
        const totalRounded = Math.round(total * 10) / 10;
        return { dateStr, total: totalRounded, count: unique.length, jobs: unique };
      });
      const weekTotal = Math.round(dailyLoads.reduce((s, d) => s + d.total, 0) * 10) / 10;
      const weekJobs = dailyLoads.reduce((s, d) => s + d.count, 0);
      return { mech, dailyLoads, weekTotal, weekJobs };
    });
  }, [jobs, days, mechanics]);

  // Shop-wide daily totals (de-duplicated by job ID, using actual hours for completed jobs)
  const shopTotals = useMemo(() => {
    const dailyTotals = days.map((day, dayIdx) => {
      const seen = new Map();
      loadData.forEach(({ dailyLoads }) => {
        dailyLoads[dayIdx].jobs.forEach((j) => {
          if (!seen.has(j.id)) seen.set(j.id, j);
        });
      });
      const uniqueJobs = Array.from(seen.values());
      const total = Math.round(uniqueJobs.reduce((s, j) => s + getJobHours(j), 0) * 10) / 10;
      return { count: uniqueJobs.length, total };
    });
    const weekGrandTotal = Math.round(dailyTotals.reduce((s, d) => s + d.total, 0) * 10) / 10;
    const weekGrandJobs = dailyTotals.reduce((s, d) => s + d.count, 0);
    return { dailyTotals, weekGrandTotal, weekGrandJobs };
  }, [loadData, days]);

  // Tooltip and selected cell state for heatmap interaction
  const [tooltip, setTooltip] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);

  // Job Finished count (Ready for Pickup + isPaid)
  const jobFinishedCount = useMemo(() => {
    // If date range filter is active, scope to that range
    if (dateRange.start && dateRange.end) {
      return jobs.filter((j) => {
        if (j.status !== JOB_STATUSES.READY_FOR_PICKUP || !j.isPaid) return false;
        if (!j.appointmentDate) return false;
        // Parse MM/dd/yyyy
        const [m, d, y] = j.appointmentDate.split('/');
        const jobDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        return isWithinInterval(jobDate, { start: dateRange.start, end: dateRange.end });
      }).length;
    }
    // If no filter, scope to current week
    return jobs.filter((j) => {
      if (j.status !== JOB_STATUSES.READY_FOR_PICKUP || !j.isPaid) return false;
      if (!j.appointmentDate) return false;
      const [m, d, y] = j.appointmentDate.split('/');
      const jobDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return isWithinInterval(jobDate, { start: weekStart, end: weekEnd });
    }).length;
  }, [jobs, weekStart, weekEnd, dateRange]);

  // Total Job Finished (all time, unfiltered)
  const jobFinishedAllTime = useMemo(() => {
    return jobs.filter(
      (j) => j.status === JOB_STATUSES.READY_FOR_PICKUP && j.isPaid
    ).length;
  }, [jobs]);

  // Filtered stats based on date range or week
  const filteredStats = useMemo(() => {
    const inRange = (j) => {
      if (!j.appointmentDate) return false;
      const [m, d, y] = j.appointmentDate.split('/');
      const jobDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      if (dateRange.start && dateRange.end) {
        return isWithinInterval(jobDate, { start: dateRange.start, end: dateRange.end });
      }
      return isWithinInterval(jobDate, { start: weekStart, end: weekEnd });
    };

    const rangeJobs = jobs.filter(inRange);
    return {
      totalActive: jobs.filter((j) => j.status !== JOB_STATUSES.READY_FOR_PICKUP).length,
      awaitingParts: jobs.filter((j) => j.partsOrdered).length,
      unassigned: jobs.filter((j) => !j.assignedMechanic && !j.isCanceled).length,
      scheduledInRange: rangeJobs.length,
    };
  }, [jobs, weekStart, weekEnd, dateRange]);

  // Calendar days for mini calendar
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [calendarMonth]);

  // Job count per day for calendar
  const jobCountsByDay = useMemo(() => {
    const counts = {};
    jobs.forEach((j) => {
      if (j.appointmentDate) {
        counts[j.appointmentDate] = (counts[j.appointmentDate] || 0) + 1;
      }
    });
    return counts;
  }, [jobs]);

  // Calendar date click handler for range selection
  const handleCalendarDateClick = (day) => {
    if (!dateRange.start || selectingEnd) {
      // If we have a start and are selecting end
      if (selectingEnd && dateRange.start) {
        const rangeStart = day < dateRange.start ? day : dateRange.start;
        const rangeEnd = day < dateRange.start ? dateRange.start : day;
        setDateRange({ start: rangeStart, end: rangeEnd });
        setSelectingEnd(false);
      } else {
        // Selecting start
        setDateRange({ start: day, end: day });
        setSelectingEnd(true);
      }
    } else {
      // Reset and start new selection
      setDateRange({ start: day, end: day });
      setSelectingEnd(true);
    }
  };

  const clearDateRange = () => {
    setDateRange({ start: null, end: null });
    setSelectingEnd(false);
  };

  const isInDateRange = (day) => {
    if (!dateRange.start || !dateRange.end) return false;
    return isWithinInterval(day, { start: dateRange.start, end: dateRange.end });
  };

  const isRangeStart = (day) => dateRange.start && isSameDay(day, dateRange.start);
  const isRangeEnd = (day) => dateRange.end && isSameDay(day, dateRange.end);

  // Date range label
  const dateRangeLabel = dateRange.start && dateRange.end
    ? isSameDay(dateRange.start, dateRange.end)
      ? format(dateRange.start, 'MM/dd/yyyy')
      : `${format(dateRange.start, 'MM/dd/yyyy')} — ${format(dateRange.end, 'MM/dd/yyyy')}`
    : null;

  return (
    <div className="space-y-6">
      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* JOB FINISHED — primary highlight card */}
        <div className="sm:col-span-1 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-400 dark:border-emerald-600 rounded-lg p-4 relative overflow-hidden">
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                Job Finished
              </p>
            </div>
            <p className="text-3xl font-black text-emerald-700 dark:text-emerald-300">
              {jobFinishedCount}
            </p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
              {dateRangeLabel ? 'Filtered range' : 'This week'} &middot; {jobFinishedAllTime} all time
            </p>
          </div>
        </div>

        <StatCard
          icon={ClipboardList}
          label="Total Active Jobs"
          value={filteredStats.totalActive}
        />
        <StatCard
          icon={Package}
          label="Awaiting Parts"
          value={filteredStats.awaitingParts}
        />
        <StatCard
          icon={UserX}
          label="Unassigned Jobs"
          value={filteredStats.unassigned}
        />
        <StatCard
          icon={CalendarDays}
          label={dateRangeLabel ? 'In Range' : 'This Week Scheduled'}
          value={filteredStats.scheduledInRange}
        />
      </div>

      {/* Date filtering section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            Date Filter
          </h4>
          <div className="flex items-center gap-2">
            {dateRangeLabel && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                {dateRangeLabel}
                <button onClick={clearDateRange} className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                showCalendar
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 inline mr-1" />
              {showCalendar ? 'Hide Calendar' : 'Show Calendar'}
            </button>
          </div>
        </div>

        {/* Week Selector Dropdown */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Quick:</span>
          {weekPresets.map((p) => (
            <button
              key={p.offset}
              onClick={() => {
                setWeekOffset(p.offset);
                clearDateRange();
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                weekOffset === p.offset && !dateRange.start
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Embedded Mini Calendar for Date Range Selection */}
        {showCalendar && (
          <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="max-w-sm mx-auto">
              {/* Calendar header */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                  className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
                <h5 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {format(calendarMonth, 'MMMM yyyy')}
                </h5>
                <button
                  onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                  className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
                  <div key={d} className="text-center text-[10px] font-semibold text-gray-400 dark:text-gray-500 py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {calendarDays.map((day) => {
                  const dateStr = format(day, 'MM/dd/yyyy');
                  const jobCount = jobCountsByDay[dateStr] || 0;
                  const inMonth = isSameMonth(day, calendarMonth);
                  const today = isToday(day);
                  const inRange = isInDateRange(day);
                  const rangeStart = isRangeStart(day);
                  const rangeEnd = isRangeEnd(day);

                  return (
                    <button
                      key={dateStr}
                      onClick={() => handleCalendarDateClick(day)}
                      className={`relative py-1.5 rounded text-xs text-center transition-all ${
                        !inMonth ? 'opacity-30' : ''
                      } ${
                        rangeStart || rangeEnd
                          ? 'bg-blue-600 text-white font-bold'
                          : inRange
                          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200'
                          : today
                          ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-bold ring-1 ring-blue-300 dark:ring-blue-700'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {format(day, 'd')}
                      {jobCount > 0 && (
                        <span className={`block text-[8px] leading-none mt-0.5 font-medium ${
                          rangeStart || rangeEnd
                            ? 'text-blue-200'
                            : inRange
                            ? 'text-blue-500 dark:text-blue-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {jobCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Calendar helper text */}
              <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-2">
                {selectingEnd
                  ? 'Click another date to complete the range'
                  : 'Click a date to start range selection'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mechanic Daily Load Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Mechanic Daily Load
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-2"
            >
              This Week
            </button>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Week label */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {format(weekStart, 'MMM d')} — {format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'MMM d, yyyy')}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  Mechanic
                </th>
                {days.map((day) => (
                  <th
                    key={day.toISOString()}
                    className="text-center py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400"
                  >
                    <div>{format(day, 'EEE')}</div>
                    <div className="font-normal">{format(day, 'MM/dd')}</div>
                  </th>
                ))}
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  Week Total
                </th>
              </tr>
            </thead>
            <tbody>
              {loadData.map(({ mech, dailyLoads, weekTotal, weekJobs }) => (
                <tr
                  key={mech.id}
                  className="border-b border-gray-100 dark:border-gray-800"
                >
                  <td className="py-2 px-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                    {getMechanicDisplay(mech)}
                  </td>
                  {dailyLoads.map((load) => {
                    const isSelected = selectedCell?.mechName === mech.name && selectedCell?.dateStr === load.dateStr;
                    const cellBg = load.count === 0
                      ? 'bg-gray-50 dark:bg-gray-800/50'
                      : load.total > 8
                      ? 'bg-red-100 dark:bg-red-900/40'
                      : load.total > 4
                      ? 'bg-amber-100 dark:bg-amber-900/40'
                      : 'bg-emerald-100 dark:bg-emerald-900/40';
                    const cellText = load.count === 0
                      ? 'text-gray-300 dark:text-gray-600'
                      : load.total > 8
                      ? 'text-red-700 dark:text-red-300'
                      : load.total > 4
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-emerald-700 dark:text-emerald-300';
                    return (
                      <td key={load.dateStr} className="py-1.5 px-1.5">
                        <div
                          className={`rounded-lg px-2 py-2 text-center transition-all ${cellBg} ${
                            load.count > 0 ? 'cursor-pointer hover:ring-2 hover:ring-blue-400/50' : ''
                          } ${isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''}`}
                          onMouseEnter={(e) => {
                            if (load.count === 0) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({ mechName: getMechanicDisplay(mech), dateStr: load.dateStr, jobs: load.jobs, rect });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                          onClick={() => {
                            if (load.count === 0) return;
                            if (isSelected) {
                              setSelectedCell(null);
                            } else {
                              setSelectedCell({ mechName: getMechanicDisplay(mech), dateStr: load.dateStr, jobs: load.jobs });
                            }
                          }}
                        >
                          {load.count > 0 ? (
                            <>
                              <span className={`text-xs font-bold ${cellText}`}>
                                {load.count} / {load.total}h
                              </span>
                              {load.total > 8 && (
                                <AlertTriangle className={`w-3 h-3 inline ml-1 -mt-0.5 ${cellText}`} />
                              )}
                            </>
                          ) : (
                            <span className={`text-xs ${cellText}`}>—</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="py-2 px-3 text-center">
                    {weekTotal > 0 ? (
                      <div className="flex flex-col items-center gap-1">
                        <MiniGauge value={weekTotal} max={40} />
                        <span className={`text-[10px] font-bold ${
                          weekTotal > 40 ? 'text-red-600 dark:text-red-400' : weekTotal > 20 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {weekTotal}h
                        </span>
                        <span className="text-[9px] text-gray-400 dark:text-gray-500 leading-none">
                          {weekJobs} job{weekJobs !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {/* Shop Totals Row */}
              <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">
                <td className="py-2 px-3 font-bold text-gray-900 dark:text-white whitespace-nowrap text-xs uppercase tracking-wide">
                  Shop Total
                </td>
                {shopTotals.dailyTotals.map((dt, idx) => {
                  const cellBg = dt.count === 0
                    ? ''
                    : dt.total > 8 * mechanics.length * 0.5
                    ? 'bg-red-50 dark:bg-red-950/30'
                    : dt.total > 4 * mechanics.length * 0.5
                    ? 'bg-amber-50 dark:bg-amber-950/30'
                    : 'bg-emerald-50 dark:bg-emerald-950/30';
                  const cellText = dt.count === 0
                    ? 'text-gray-300 dark:text-gray-600'
                    : dt.total > 8 * mechanics.length * 0.5
                    ? 'text-red-700 dark:text-red-300'
                    : dt.total > 4 * mechanics.length * 0.5
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-emerald-700 dark:text-emerald-300';
                  return (
                    <td key={idx} className="py-1.5 px-1.5">
                      <div className={`rounded-lg px-2 py-2 text-center ${cellBg}`}>
                        {dt.count > 0 ? (
                          <span className={`text-xs font-bold ${cellText}`}>
                            {dt.count} / {dt.total}h
                          </span>
                        ) : (
                          <span className={`text-xs ${cellText}`}>—</span>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="py-2 px-3 text-center">
                  {shopTotals.weekGrandTotal > 0 ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={`text-xs font-bold ${
                        shopTotals.weekGrandTotal > 40 * mechanics.length * 0.5 ? 'text-red-600 dark:text-red-400' : shopTotals.weekGrandTotal > 20 * mechanics.length * 0.5 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {shopTotals.weekGrandTotal}h
                      </span>
                      <span className="text-[9px] text-gray-400 dark:text-gray-500">
                        {shopTotals.weekGrandJobs} job{shopTotals.weekGrandJobs !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Hover Tooltip */}
      {tooltip && (() => {
        const completed = tooltip.jobs.filter(isJobCompleted);
        const pending = tooltip.jobs.filter((j) => !isJobCompleted(j));
        return (
          <div
            className="fixed z-[200] pointer-events-none bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-3 max-w-xs"
            style={{
              left: Math.min(tooltip.rect.left, window.innerWidth - 320),
              top: tooltip.rect.bottom + 8,
            }}
          >
            <p className="text-xs font-bold text-gray-900 dark:text-white mb-1.5">
              {tooltip.mechName} — {tooltip.dateStr}
            </p>
            {completed.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mb-1 mt-1">
                  <CheckCircle2 className="w-3 h-3" /> Completed ({completed.length})
                </p>
                <div className="space-y-1 mb-1.5">
                  {completed.slice(0, 3).map((j) => (
                    <div key={j.id} className="text-[11px] leading-tight pl-1 border-l-2 border-emerald-300 dark:border-emerald-700">
                      <p className="font-medium text-gray-800 dark:text-gray-200">
                        {j.year} {j.make} {j.model}
                      </p>
                      <p className="text-gray-400 dark:text-gray-500">
                        {getJobHours(j)}h {calcActualHours(j) !== null ? 'actual' : 'est.'}
                      </p>
                    </div>
                  ))}
                  {completed.length > 3 && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 italic pl-1">
                      +{completed.length - 3} more...
                    </p>
                  )}
                </div>
              </>
            )}
            {pending.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 mb-1 mt-1">
                  <Clock className="w-3 h-3" /> Pending ({pending.length})
                </p>
                <div className="space-y-1">
                  {pending.slice(0, 3).map((j) => (
                    <div key={j.id} className="text-[11px] leading-tight pl-1 border-l-2 border-blue-300 dark:border-blue-700">
                      <p className="font-medium text-gray-800 dark:text-gray-200">
                        {j.year} {j.make} {j.model}
                      </p>
                      <p className="text-gray-400 dark:text-gray-500">
                        {j.estimatedManHours || 0}h est.
                      </p>
                    </div>
                  ))}
                  {pending.length > 3 && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 italic pl-1">
                      +{pending.length - 3} more...
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* Selected Cell Detail */}
      {selectedCell && (() => {
        const completed = selectedCell.jobs.filter(isJobCompleted);
        const pending = selectedCell.jobs.filter((j) => !isJobCompleted(j));
        const JobDetailTable = ({ jobList, label, icon: Icon, accentColor }) => (
          jobList.length > 0 && (
            <div>
              <div className={`px-4 py-2 flex items-center gap-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30`}>
                <Icon className={`w-3.5 h-3.5 ${accentColor}`} />
                <span className={`text-[11px] font-semibold uppercase tracking-wide ${accentColor}`}>
                  {label} ({jobList.length})
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                      <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">CS #</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">Vehicle</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">Services</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">Hours</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobList.map((j) => {
                      const actual = calcActualHours(j);
                      const hours = getJobHours(j);
                      const isDone = isJobCompleted(j);
                      return (
                        <tr key={j.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-2 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                            {j.queueNumber || '—'}
                          </td>
                          <td className="py-2 px-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                            {j.year} {j.make} {j.model}
                          </td>
                          <td className="py-2 px-3 text-gray-600 dark:text-gray-400 max-w-[200px] truncate">
                            {Array.isArray(j.reasonForVisit) ? j.reasonForVisit.join(', ') : j.reasonForVisit || '—'}
                          </td>
                          <td className="py-2 px-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                            {hours}h
                            {isDone && actual !== null ? (
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 ml-1">actual</span>
                            ) : (
                              <span className="text-[9px] text-gray-400 dark:text-gray-500 ml-1">est.</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <StatusBadge status={j.status} isPaid={j.isPaid} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        );
        return (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                {selectedCell.mechName} — {selectedCell.dateStr}
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                  ({selectedCell.jobs.length} job{selectedCell.jobs.length !== 1 ? 's' : ''})
                </span>
              </h4>
              <button
                onClick={() => setSelectedCell(null)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <JobDetailTable jobList={completed} label="Completed" icon={CheckCircle2} accentColor="text-emerald-600 dark:text-emerald-400" />
            <JobDetailTable jobList={pending} label="Pending" icon={Clock} accentColor="text-blue-600 dark:text-blue-400" />
          </div>
        );
      })()}

      {/* Filtered Jobs Table (when date range is active) */}
      {dateRange.start && dateRange.end && (
        <FilteredJobsTable
          jobs={jobs}
          dateRange={dateRange}
        />
      )}

    </div>
  );
}

function FilteredJobsTable({ jobs, dateRange }) {
  const mechanics = useAdminStore((s) => s.mechanics);
  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (!j.appointmentDate) return false;
      const [m, d, y] = j.appointmentDate.split('/');
      const jobDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return isWithinInterval(jobDate, { start: dateRange.start, end: dateRange.end });
    });
  }, [jobs, dateRange]);

  if (filteredJobs.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
        <p className="text-sm text-gray-400 dark:text-gray-500">
          No jobs scheduled in the selected date range.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Filtered Jobs
          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
            ({filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''})
          </span>
        </h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">Queue #</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">Vehicle</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">Customer</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">Date</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">Time</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">Mechanic</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">Status</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">Paid</th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.map((j) => (
              <tr key={j.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="py-2 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                  {j.queueNumber || '-'}
                </td>
                <td className="py-2 px-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                  {j.year} {j.make} {j.model}
                </td>
                <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{j.customerName}</td>
                <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{j.appointmentDate}</td>
                <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{j.preferredTime ? to12Hour(j.preferredTime) : '-'}</td>
                <td className="py-2 px-3">
                  {j.assignedMechanic ? (
                    <span className="text-gray-600 dark:text-gray-400">
                      {getMechanicDisplay(j.assignedMechanic, mechanics)}
                    </span>
                  ) : (
                    <span className="text-red-500 font-medium">—</span>
                  )}
                </td>
                <td className="py-2 px-3">
                  <StatusBadge status={j.status} />
                </td>
                <td className="py-2 px-3">
                  {j.isPaid ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      PAID
                    </span>
                  ) : (
                    <span className="text-gray-300 dark:text-gray-600">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniGauge({ value, max }) {
  const pct = Math.min(value / max, 1);
  const r = 16;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const color = value >= max ? '#ef4444' : value >= max * 0.625 ? '#f59e0b' : '#10b981';
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0">
      <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-gray-200 dark:text-gray-700" />
      <circle
        cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 20 20)"
        className="transition-all duration-500"
      />
    </svg>
  );
}

function StatusBadge({ status, isPaid }) {
  const styles = {
    WAITLIST: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    IN_SERVICE: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
    AWAITING_PARTS: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
    READY_FOR_PICKUP: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
    DONE: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
  };
  const labels = {
    WAITLIST: 'Waitlist',
    IN_SERVICE: 'In-Service',
    AWAITING_PARTS: 'Awaiting Parts',
    READY_FOR_PICKUP: 'Ready',
    DONE: 'Done',
  };
  const label = status === 'DONE' && isPaid ? 'Done / Paid' : (labels[status] || status);
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${styles[status] || ''}`}>
      {label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </p>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
