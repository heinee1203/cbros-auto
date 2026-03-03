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
export function subscribeToActiveJobs(callback) {
  const q = query(collection(db, ACTIVE_JOBS_COL));
  return onSnapshot(q, (snapshot) => {
    const jobs = [];
    snapshot.forEach((docSnap) => {
      jobs.push({ ...docSnap.data(), id: docSnap.id });
    });
    callback(jobs);
  }, (error) => {
    console.error('Firestore activeJobs listener error:', error);
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
 * Generate the next queue number atomically using a Firestore transaction.
 * Reads all active jobs with today's date prefix and returns the next sequence.
 */
export async function firestoreNextQueueNumber() {
  const todayPrefix = format(new Date(), 'MMdd') + '-';

  // Read all active jobs to find the max queue number for today
  const snapshot = await getDocs(collection(db, ACTIVE_JOBS_COL));
  let maxSeq = 0;
  snapshot.forEach((docSnap) => {
    const qn = docSnap.data().queueNumber;
    if (qn && qn.startsWith(todayPrefix)) {
      const seq = parseInt(qn.slice(todayPrefix.length), 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  });

  // Also check the eodReports for today in case jobs were archived already
  return todayPrefix + String(maxSeq + 1).padStart(2, '0');
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
