import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { JOB_STATUSES, STATUS_ORDER } from '../data/rosters';
import {
  firestoreAddJob,
  firestoreUpdateJob,
  firestoreSetJob,
  firestoreDeleteJob,
  firestoreNextQueueNumber,
  firestoreBatchArchive,
} from '../services/firestoreJobs';

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
 * Generate a daily-reset queue number in format MMDD-NN (local fallback).
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

/**
 * Helper: compute updated job fields for a status transition.
 * Pure function — takes current job and target status, returns the update object.
 */
const computeStatusUpdates = (job, newStatus) => {
  const updates = { status: newStatus };
  const oldIdx = STATUS_ORDER.indexOf(job.status);
  const newIdx = STATUS_ORDER.indexOf(newStatus);
  const isMovingBackward = newIdx < oldIdx;

  // Forward timestamps
  if (newStatus === JOB_STATUSES.IN_SERVICE && !job.serviceStartedAt) {
    updates.serviceStartedAt = formatDateTimestamp(new Date());
  }
  if (newStatus === JOB_STATUSES.READY_FOR_PICKUP) {
    updates.readyForPickupAt = formatTimestamp(new Date());
    if (!job.serviceDoneTime) {
      updates.serviceDoneTime = formatDateTimestamp(new Date());
    }
  }

  // Moving backward — clear completion / payment fields
  if (isMovingBackward) {
    if (job.status === JOB_STATUSES.DONE || oldIdx >= STATUS_ORDER.indexOf(JOB_STATUSES.DONE)) {
      updates.isDone = false;
      updates.doneAt = null;
      updates.isPaid = false;
      updates.paidAt = null;
    }
    if (newIdx < STATUS_ORDER.indexOf(JOB_STATUSES.READY_FOR_PICKUP)) {
      updates.serviceDoneTime = null;
      updates.readyForPickupAt = null;
    }
  }

  return updates;
};

export const useJobsStore = create((set, get) => ({
  jobs: [],
  archivedJobs: [],
  closedDates: [],

  // ── Firestore-fed setters (called by FirebaseSyncProvider) ──────────────
  _setJobsFromFirestore: (jobs) => set({ jobs }),
  _setClosedDatesFromFirestore: (dates) => set({ closedDates: dates }),
  _setArchivedJobsFromFirestore: (archivedJobs) => set({ archivedJobs }),

  // ── Job CRUD ────────────────────────────────────────────────────────────
  addJob: async (data) => {
    const now = new Date();
    // Generate queue number from current Firestore state for consistency
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
    // Optimistic update
    set((state) => ({ jobs: [job, ...state.jobs] }));
    // Write to Firestore (listener will confirm)
    try {
      await firestoreAddJob(job);
    } catch (err) {
      console.error('Failed to add job to Firestore:', err);
    }
    return job.id;
  },

  updateJob: async (id, updates) => {
    // Optimistic update
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
    }));
    try {
      await firestoreUpdateJob(id, updates);
    } catch (err) {
      console.error('Failed to update job in Firestore:', err);
    }
  },

  moveJobForward: async (id) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job) return;
    const idx = STATUS_ORDER.indexOf(job.status);
    if (idx >= STATUS_ORDER.length - 1) return;

    const nextStatus = STATUS_ORDER[idx + 1];
    const updates = { status: nextStatus };
    if (nextStatus === JOB_STATUSES.IN_SERVICE && !job.serviceStartedAt) {
      updates.serviceStartedAt = formatDateTimestamp(new Date());
    }
    if (nextStatus === JOB_STATUSES.READY_FOR_PICKUP && !job.serviceDoneTime) {
      updates.serviceDoneTime = formatDateTimestamp(new Date());
    }

    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
    }));
    try {
      await firestoreUpdateJob(id, updates);
    } catch (err) {
      console.error('Failed to move job forward in Firestore:', err);
    }
  },

  moveJobBackward: async (id) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job) return;
    const idx = STATUS_ORDER.indexOf(job.status);
    if (idx <= 0) return;

    const prevStatus = STATUS_ORDER[idx - 1];
    const updates = { status: prevStatus };
    // Moving back FROM Done → clear completion/payment timestamps
    // Keep serviceDoneTime so actual labor time is preserved
    if (job.status === JOB_STATUSES.DONE) {
      updates.isDone = false;
      updates.doneAt = null;
      updates.isPaid = false;
      updates.paidAt = null;
    }
    // Moving back FROM Ready for Pickup → clear serviceDone & readyForPickup timestamps
    if (job.status === JOB_STATUSES.READY_FOR_PICKUP) {
      updates.serviceDoneTime = null;
      updates.readyForPickupAt = null;
    }

    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
    }));
    try {
      await firestoreUpdateJob(id, updates);
    } catch (err) {
      console.error('Failed to move job backward in Firestore:', err);
    }
  },

  setJobStatus: async (id, status) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job) return;

    const updates = computeStatusUpdates(job, status);

    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
    }));
    try {
      await firestoreUpdateJob(id, updates);
    } catch (err) {
      console.error('Failed to set job status in Firestore:', err);
    }
  },

  assignBay: async (id, bayId) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job) return;
    const updates = { assignedBay: bayId };
    if (!job.serviceStartedAt) {
      updates.serviceStartedAt = formatDateTimestamp(new Date());
    }

    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
    }));
    try {
      await firestoreUpdateJob(id, updates);
    } catch (err) {
      console.error('Failed to assign bay in Firestore:', err);
    }
  },

  clearBay: async (id) => {
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id ? { ...j, assignedBay: null } : j
      ),
    }));
    try {
      await firestoreUpdateJob(id, { assignedBay: null });
    } catch (err) {
      console.error('Failed to clear bay in Firestore:', err);
    }
  },

  togglePaid: async (id) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job) return;
    const nowPaid = !job.isPaid;
    const updates = {
      isPaid: nowPaid,
      paidAt: nowPaid ? formatTimestamp(new Date()) : null,
    };
    if (nowPaid && job.status === JOB_STATUSES.READY_FOR_PICKUP) {
      updates.status = JOB_STATUSES.DONE;
      if (job.assignedBay) updates.assignedBay = null;
      if (!job.serviceDoneTime) updates.serviceDoneTime = formatDateTimestamp(new Date());
    } else if (!nowPaid && job.status === JOB_STATUSES.DONE) {
      updates.status = JOB_STATUSES.READY_FOR_PICKUP;
      updates.isDone = false;
      updates.doneAt = null;
    }

    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
    }));
    try {
      await firestoreUpdateJob(id, updates);
    } catch (err) {
      console.error('Failed to toggle paid in Firestore:', err);
    }
  },

  toggleDone: async (id) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job) return;
    const nowDone = !job.isDone;
    const updates = {
      isDone: nowDone,
      doneAt: nowDone ? formatTimestamp(new Date()) : null,
    };
    if (nowDone && job.status === JOB_STATUSES.READY_FOR_PICKUP) {
      updates.status = JOB_STATUSES.DONE;
      if (job.assignedBay) updates.assignedBay = null;
      if (!job.serviceDoneTime) updates.serviceDoneTime = formatDateTimestamp(new Date());
    } else if (!nowDone && job.status === JOB_STATUSES.DONE) {
      updates.status = JOB_STATUSES.READY_FOR_PICKUP;
      updates.isPaid = false;
      updates.paidAt = null;
    }

    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
    }));
    try {
      await firestoreUpdateJob(id, updates);
    } catch (err) {
      console.error('Failed to toggle done in Firestore:', err);
    }
  },

  markDonePaid: async (id) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job) return;
    const updates = {
      status: JOB_STATUSES.DONE,
      isPaid: true,
      paidAt: formatTimestamp(new Date()),
      assignedBay: null,
    };
    if (!job.serviceDoneTime) {
      updates.serviceDoneTime = formatDateTimestamp(new Date());
    }

    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
    }));
    try {
      await firestoreUpdateJob(id, updates);
    } catch (err) {
      console.error('Failed to mark done/paid in Firestore:', err);
    }
  },

  cancelJob: async (id, reason) => {
    const updates = {
      isCanceled: true,
      canceledAt: formatTimestamp(new Date()),
      cancelReason: reason || '',
      status: JOB_STATUSES.DONE,
      assignedBay: null,
    };

    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
    }));
    try {
      await firestoreUpdateJob(id, updates);
    } catch (err) {
      console.error('Failed to cancel job in Firestore:', err);
    }
  },

  togglePartsOrdered: async (id) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job) return;
    const newVal = !job.partsOrdered;

    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id ? { ...j, partsOrdered: newVal } : j
      ),
    }));
    try {
      await firestoreUpdateJob(id, { partsOrdered: newVal });
    } catch (err) {
      console.error('Failed to toggle parts ordered in Firestore:', err);
    }
  },

  assignMechanic: async (id, mechanic) => {
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id ? { ...j, assignedMechanic: mechanic } : j
      ),
    }));
    try {
      await firestoreUpdateJob(id, { assignedMechanic: mechanic });
    } catch (err) {
      console.error('Failed to assign mechanic in Firestore:', err);
    }
  },

  assignAssistantMechanic: async (id, mechanic) => {
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id ? { ...j, assistantMechanic: mechanic } : j
      ),
    }));
    try {
      await firestoreUpdateJob(id, { assistantMechanic: mechanic });
    } catch (err) {
      console.error('Failed to assign assistant mechanic in Firestore:', err);
    }
  },

  deleteJob: async (id) => {
    set((state) => ({
      jobs: state.jobs.filter((j) => j.id !== id),
    }));
    try {
      await firestoreDeleteJob(id);
    } catch (err) {
      console.error('Failed to delete job from Firestore:', err);
    }
  },

  closeOutDay: async () => {
    const state = get();
    const now = new Date();
    const closedDate = formatDate(now);
    const closedTime = formatTimestamp(now);

    // DONE + cancelled → archive
    const toArchive = state.jobs.filter(
      (j) => j.status === JOB_STATUSES.DONE || j.isCanceled
    );
    // Active jobs carry over
    const carryOver = state.jobs.filter(
      (j) => j.status !== JOB_STATUSES.DONE && !j.isCanceled
    );

    // Optimistic local update
    set({
      jobs: carryOver,
      closedDates: state.closedDates.includes(closedDate)
        ? state.closedDates
        : [...state.closedDates, closedDate],
    });

    // Write to Firestore (batch archive)
    try {
      await firestoreBatchArchive(toArchive, closedDate, closedTime);
    } catch (err) {
      console.error('Failed to close out day in Firestore:', err);
      throw err; // Re-throw so the UI can show an error
    }
  },

  resetAllData: () => set({ jobs: [], archivedJobs: [], closedDates: [] }),

  // ── Computed getters ──────────────────────────────────────────────────
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
}));
