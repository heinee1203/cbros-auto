import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  writeBatch,
  runTransaction,
  getDocs,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format } from 'date-fns';

const ACTIVE_JOBS_COL = 'activeJobs';

/**
 * Subscribe to real-time updates on all active jobs.
 * Returns an unsubscribe function.
 */
export function subscribeToActiveJobs(callback, onError) {
  const q = query(collection(db, ACTIVE_JOBS_COL));
  return onSnapshot(q, (snapshot) => {
    const jobs = [];
    snapshot.forEach((docSnap) => {
      // Skip internal counter/meta documents — they're not jobs
      if (docSnap.id === '_queueCounter' || docSnap.id.startsWith('_qc_') || docSnap.id === '_closedDates') return;
      const data = docSnap.data();
      // Safety: skip any doc that doesn't look like a valid job
      if (!data.customerName && !data.dateReceived && !data.status) return;
      jobs.push({ ...data, id: docSnap.id });
    });
    callback(jobs);
  }, (error) => {
    console.error('Firestore activeJobs listener error:', error);
    if (onError) onError(error);
  });
}

/**
 * Add a new job document to Firestore.
 */
export async function firestoreAddJob(job) {
  await setDoc(doc(db, ACTIVE_JOBS_COL, job.id), job);
}

/**
 * Update specific fields on a job document.
 */
export async function firestoreUpdateJob(id, updates) {
  await updateDoc(doc(db, ACTIVE_JOBS_COL, id), updates);
}

/**
 * Replace an entire job document (used for complex state transitions).
 */
export async function firestoreSetJob(job) {
  await setDoc(doc(db, ACTIVE_JOBS_COL, job.id), job);
}

/**
 * Delete a job document from activeJobs.
 */
export async function firestoreDeleteJob(id) {
  await deleteDoc(doc(db, ACTIVE_JOBS_COL, id));
}

/**
 * Get today's date prefix in MMDD format using Philippine Standard Time (UTC+8).
 */
export function getPSTDatePrefix() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const mm = parts.find((p) => p.type === 'month').value;
  const dd = parts.find((p) => p.type === 'day').value;
  return mm + dd;
}

/**
 * Convert an appointmentDate string ("MM/dd/yyyy") to a MMDD prefix.
 * Returns null if input is missing or invalid.
 */
function appointmentToPrefix(appointmentDate) {
  if (!appointmentDate) return null;
  const m = appointmentDate.match(/^(\d{2})\/(\d{2})\/\d{4}$/);
  return m ? m[1] + m[2] : null;
}

/**
 * Generate the next queue number atomically using a Firestore transaction.
 *
 * @param {string|null} appointmentDate - "MM/dd/yyyy" format or null for walk-ins.
 *   If a future appointment date is provided, the prefix uses that date (e.g., "0310").
 *   Otherwise the current PST date is used (e.g., "0305").
 *
 * Uses per-date counter documents (activeJobs/_qc_MMDD) for concurrency safety.
 * Cross-checks existing jobs to avoid duplicates if counter is out of sync.
 */
export async function firestoreNextQueueNumber(appointmentDate) {
  const datePrefix = appointmentToPrefix(appointmentDate) || getPSTDatePrefix();
  const counterRef = doc(db, ACTIVE_JOBS_COL, `_qc_${datePrefix}`);

  const queueNumber = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);

    // Scan existing jobs to find the highest sequence for this date prefix
    const jobsSnap = await getDocs(query(collection(db, ACTIVE_JOBS_COL)));
    let maxExisting = 0;
    const prefix = datePrefix + '-';
    jobsSnap.forEach((docSnap) => {
      if (docSnap.id.startsWith('_qc_') || docSnap.id === '_queueCounter') return;
      const qn = docSnap.data().queueNumber;
      if (qn && qn.startsWith(prefix)) {
        const seq = parseInt(qn.slice(prefix.length), 10);
        if (!isNaN(seq) && seq > maxExisting) maxExisting = seq;
      }
    });

    let nextSeq = 1;
    if (counterSnap.exists()) {
      nextSeq = (counterSnap.data().seq || 0) + 1;
    }

    // Use whichever is higher: counter or actual max from existing jobs
    if (maxExisting >= nextSeq) {
      nextSeq = maxExisting + 1;
    }

    // Write the updated counter atomically
    transaction.set(counterRef, { seq: nextSeq });

    return prefix + String(nextSeq).padStart(2, '0');
  });

  return queueNumber;
}

/**
 * Archive completed/cancelled jobs to eodReports and remove from activeJobs.
 * Uses a batch write for atomicity.
 */
export async function firestoreBatchArchive(jobsToArchive, closedDate, closedTime) {
  const batch = writeBatch(db);
  const dateKey = format(new Date(), 'yyyy-MM-dd');

  // Create the EOD report document
  const reportRef = doc(db, 'eodReports', dateKey);
  batch.set(reportRef, { closedAt: closedDate, closedTime }, { merge: true });

  // Add each archived job as a subcollection document
  jobsToArchive.forEach((job) => {
    const archivedJob = {
      ...job,
      archivedAt: `${closedDate} at ${closedTime}`,
    };
    const archiveRef = doc(collection(db, 'eodReports', dateKey, 'archivedJobs'), job.id);
    batch.set(archiveRef, archivedJob);
  });

  // Delete archived jobs from activeJobs
  jobsToArchive.forEach((job) => {
    batch.delete(doc(db, ACTIVE_JOBS_COL, job.id));
  });

  // Update the closed dates tracker
  // We merge the date into the _closedDates doc
  const closedDatesRef = doc(db, 'eodReports', '_closedDates');

  await batch.commit();

  // Update closed dates separately (arrayUnion requires updateDoc)
  try {
    await updateDoc(closedDatesRef, { dates: arrayUnion(closedDate) });
  } catch (e) {
    // Doc doesn't exist yet, create it
    await setDoc(closedDatesRef, { dates: [closedDate] });
  }
}
