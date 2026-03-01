import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { JOB_STATUSES, STATUS_ORDER } from '../data/rosters';

const formatDate = (d) => format(d, 'MM/dd/yyyy');

/**
 * Format a Date to strict 12-hour time string like "01:52 PM"
 */
const formatTimestamp = (d) => {
  let hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, '0')}:${mins} ${ampm}`;
};

/**
 * Format a Date to full date+time string like "02/27/2026 at 09:15 AM"
 */
const formatDateTimestamp = (d) => `${formatDate(d)} at ${formatTimestamp(d)}`;

/**
 * Convert a 24-hour time string "HH:mm" to 12-hour format "hh:mm AM/PM"
 */
export const to12Hour = (time24) => {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
};

/**
 * Generate a daily-reset queue number in format MMDD-NN
 * e.g. 0221-01, 0221-02, etc. Resets sequence each new day.
 */
const generateQueueNumber = (existingJobs) => {
  const today = format(new Date(), 'MMdd');
  const prefix = today + '-';
  let maxSeq = 0;
  existingJobs.forEach((j) => {
    if (j.queueNumber && j.queueNumber.startsWith(prefix)) {
      const seq = parseInt(j.queueNumber.slice(prefix.length), 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  });
  const nextSeq = String(maxSeq + 1).padStart(2, '0');
  return prefix + nextSeq;
};

/**
 * Helper: returns an array of all mechanic names assigned to a job (lead + assistant).
 */
export const getJobMechanics = (job) => {
  const names = [];
  if (job.assignedMechanic) names.push(job.assignedMechanic);
  if (job.assistantMechanic) names.push(job.assistantMechanic);
  return names;
};

/**
 * Helper: check if a mechanic name is assigned to a job (as lead or assistant).
 */
export const isMechanicOnJob = (job, mechanicName) => {
  return job.assignedMechanic === mechanicName || job.assistantMechanic === mechanicName;
};

export const useJobsStore = create(
  persist(
    (set, get) => ({
      jobs: [],
      archivedJobs: [],
      closedDates: [],

      addJob: (data) => {
        const now = new Date();
        const queueNumber = generateQueueNumber(get().jobs);
        const job = {
          id: uuidv4(),
          queueNumber,
          createdAt: now.toISOString(),
          dateReceived: formatDate(now),
          intakeTimestamp: formatTimestamp(now),
          status: JOB_STATUSES.WAITLIST,
          customerName: data.customerName,
          phoneNumber: data.phoneNumber,
          year: data.year,
          make: data.make,
          model: data.model,
          vin: data.vin || '',
          plateNumber: data.plateNumber || '',
          intakeType: data.intakeType || 'walk-in',
          odometerReading: data.odometerReading || '',
          reasonForVisit: data.reasonForVisit,
          frontDeskLead: data.frontDeskLead,
          assignedMechanic: data.assignedMechanic || '',
          assistantMechanic: data.assistantMechanic || '',
          appointmentDate: data.appointmentDate || null,
          preferredTime: data.preferredTime || null,
          estimatedManHours: data.estimatedManHours || null,
          estimatedCompletion: data.estimatedCompletion || null,
          partsOrdered: false,
          internalNotes: data.internalNotes || '',
          assignedBay: null,
          serviceStartedAt: null,
          serviceDoneTime: null,
          readyForPickupAt: null,
          isPaid: false,
          paidAt: null,
          isDone: false,
          doneAt: null,
          isCanceled: false,
          canceledAt: null,
        };
        set((state) => ({ jobs: [job, ...state.jobs] }));
        return job.id;
      },

      updateJob: (id, updates) =>
        set((state) => ({
          jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
        })),

      moveJobForward: (id) =>
        set((state) => ({
          jobs: state.jobs.map((j) => {
            if (j.id !== id) return j;
            const idx = STATUS_ORDER.indexOf(j.status);
            if (idx < STATUS_ORDER.length - 1) {
              const nextStatus = STATUS_ORDER[idx + 1];
              const updates = { status: nextStatus };
              if (nextStatus === JOB_STATUSES.IN_SERVICE && !j.serviceStartedAt) {
                updates.serviceStartedAt = formatDateTimestamp(new Date());
              }
              if (nextStatus === JOB_STATUSES.READY_FOR_PICKUP && !j.serviceDoneTime) {
                updates.serviceDoneTime = formatDateTimestamp(new Date());
              }
              return { ...j, ...updates };
            }
            return j;
          }),
        })),

      moveJobBackward: (id) =>
        set((state) => ({
          jobs: state.jobs.map((j) => {
            if (j.id !== id) return j;
            const idx = STATUS_ORDER.indexOf(j.status);
            if (idx > 0) {
              return { ...j, status: STATUS_ORDER[idx - 1] };
            }
            return j;
          }),
        })),

      setJobStatus: (id, status) =>
        set((state) => ({
          jobs: state.jobs.map((j) => {
            if (j.id !== id) return j;
            const updates = { status };
            if (status === JOB_STATUSES.IN_SERVICE && !j.serviceStartedAt) {
              updates.serviceStartedAt = formatDateTimestamp(new Date());
            }
            if (status === JOB_STATUSES.READY_FOR_PICKUP) {
              updates.readyForPickupAt = formatTimestamp(new Date());
              if (!j.serviceDoneTime) {
                updates.serviceDoneTime = formatDateTimestamp(new Date());
              }
            }
            return { ...j, ...updates };
          }),
        })),

      assignBay: (id, bayId) =>
        set((state) => ({
          jobs: state.jobs.map((j) => {
            if (j.id !== id) return j;
            const updates = { assignedBay: bayId };
            if (!j.serviceStartedAt) {
              updates.serviceStartedAt = formatDateTimestamp(new Date());
            }
            return { ...j, ...updates };
          }),
        })),

      clearBay: (id) =>
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === id ? { ...j, assignedBay: null } : j
          ),
        })),

      togglePaid: (id) =>
        set((state) => ({
          jobs: state.jobs.map((j) => {
            if (j.id !== id) return j;
            const nowPaid = !j.isPaid;
            const updates = {
              isPaid: nowPaid,
              paidAt: nowPaid ? formatTimestamp(new Date()) : null,
            };
            // Auto-move: Paid ON → DONE column; Paid OFF → back to Ready for Pickup
            if (nowPaid && j.status === JOB_STATUSES.READY_FOR_PICKUP) {
              updates.status = JOB_STATUSES.DONE;
              if (j.assignedBay) updates.assignedBay = null;
              if (!j.serviceDoneTime) updates.serviceDoneTime = formatDateTimestamp(new Date());
            } else if (!nowPaid && j.status === JOB_STATUSES.DONE) {
              updates.status = JOB_STATUSES.READY_FOR_PICKUP;
            }
            return { ...j, ...updates };
          }),
        })),

      toggleDone: (id) =>
        set((state) => ({
          jobs: state.jobs.map((j) => {
            if (j.id !== id) return j;
            const nowDone = !j.isDone;
            const updates = {
              isDone: nowDone,
              doneAt: nowDone ? formatTimestamp(new Date()) : null,
            };
            // Auto-move: Done ON → DONE column; Done OFF → back to Ready for Pickup
            if (nowDone && j.status === JOB_STATUSES.READY_FOR_PICKUP) {
              updates.status = JOB_STATUSES.DONE;
              if (j.assignedBay) updates.assignedBay = null;
              if (!j.serviceDoneTime) updates.serviceDoneTime = formatDateTimestamp(new Date());
            } else if (!nowDone && j.status === JOB_STATUSES.DONE) {
              updates.status = JOB_STATUSES.READY_FOR_PICKUP;
            }
            return { ...j, ...updates };
          }),
        })),

      markDonePaid: (id) =>
        set((state) => ({
          jobs: state.jobs.map((j) => {
            if (j.id !== id) return j;
            return {
              ...j,
              status: JOB_STATUSES.DONE,
              isPaid: true,
              paidAt: formatTimestamp(new Date()),
              assignedBay: null,
              ...(j.serviceDoneTime ? {} : { serviceDoneTime: formatDateTimestamp(new Date()) }),
            };
          }),
        })),

      cancelJob: (id, reason) =>
        set((state) => ({
          jobs: state.jobs.map((j) => {
            if (j.id !== id) return j;
            return {
              ...j,
              isCanceled: true,
              canceledAt: formatTimestamp(new Date()),
              cancelReason: reason || '',
              status: JOB_STATUSES.DONE,
              assignedBay: null,
            };
          }),
        })),

      togglePartsOrdered: (id) =>
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === id ? { ...j, partsOrdered: !j.partsOrdered } : j
          ),
        })),

      assignMechanic: (id, mechanic) =>
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === id ? { ...j, assignedMechanic: mechanic } : j
          ),
        })),

      assignAssistantMechanic: (id, mechanic) =>
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === id ? { ...j, assistantMechanic: mechanic } : j
          ),
        })),

      deleteJob: (id) =>
        set((state) => ({
          jobs: state.jobs.filter((j) => j.id !== id),
        })),

      closeOutDay: () =>
        set((state) => {
          const now = new Date();
          const closedDate = formatDate(now);
          const closedTime = formatTimestamp(now);

          // DONE + cancelled → archive
          const toArchive = state.jobs.filter(
            (j) => j.status === JOB_STATUSES.DONE || j.isCanceled
          );
          // Active jobs carry over (WAITLIST, IN_SERVICE, AWAITING_PARTS, READY_FOR_PICKUP that aren't cancelled)
          const carryOver = state.jobs.filter(
            (j) => j.status !== JOB_STATUSES.DONE && !j.isCanceled
          );

          const archived = toArchive.map((j) => ({
            ...j,
            archivedAt: `${closedDate} at ${closedTime}`,
          }));

          return {
            jobs: carryOver,
            archivedJobs: [...archived, ...state.archivedJobs],
            closedDates: state.closedDates.includes(closedDate)
              ? state.closedDates
              : [...state.closedDates, closedDate],
          };
        }),

      resetAllData: () => set({ jobs: [], archivedJobs: [], closedDates: [] }),

      getJobsByStatus: (status) => get().jobs.filter((j) => j.status === status),

      getJobsByDate: (dateStr) =>
        get().jobs.filter((j) => j.appointmentDate === dateStr),

      getOccupiedBays: () => {
        return get()
          .jobs.filter(
            (j) =>
              (j.status === JOB_STATUSES.IN_SERVICE ||
                j.status === JOB_STATUSES.AWAITING_PARTS) &&
              j.assignedBay
          )
          .reduce((map, j) => {
            map[j.assignedBay] = j;
            return map;
          }, {});
      },

      /** Get total hours for a mechanic on a date — checks BOTH lead and assistant */
      getMechanicHoursForDate: (mechanic, dateStr) => {
        return get()
          .jobs.filter(
            (j) =>
              isMechanicOnJob(j, mechanic) &&
              j.appointmentDate === dateStr &&
              j.estimatedManHours
          )
          .reduce((sum, j) => sum + (j.estimatedManHours || 0), 0);
      },

      /** Get all mechanic loads for a date — applies hours to BOTH lead and assistant */
      getAllMechanicLoadsForDate: (dateStr) => {
        const jobs = get().jobs.filter(
          (j) => j.appointmentDate === dateStr && j.estimatedManHours
        );
        const loads = {};
        jobs.forEach((j) => {
          const hours = j.estimatedManHours || 0;
          if (j.assignedMechanic) {
            if (!loads[j.assignedMechanic]) loads[j.assignedMechanic] = 0;
            loads[j.assignedMechanic] += hours;
          }
          if (j.assistantMechanic) {
            if (!loads[j.assistantMechanic]) loads[j.assistantMechanic] = 0;
            loads[j.assistantMechanic] += hours;
          }
        });
        return loads;
      },
    }),
    {
      name: 'cbros-jobs',
    }
  )
);
