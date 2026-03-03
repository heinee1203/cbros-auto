import {
  doc,
  getDoc,
  getDocs,
  collection,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Subscribe to real-time updates on the closed dates tracker.
 * Returns an unsubscribe function.
 */
export function subscribeToClosedDates(callback) {
  return onSnapshot(doc(db, 'eodReports', '_closedDates'), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data().dates || []);
    } else {
      callback([]);
    }
  }, (error) => {
    console.error('Firestore closedDates listener error:', error);
  });
}

/**
 * Fetch archived jobs for a specific date from the eodReports subcollection.
 * Used by ArchiveViewer for lazy loading.
 */
export async function fetchArchivedJobsByDate(dateKey) {
  try {
    const archivedCol = collection(db, 'eodReports', dateKey, 'archivedJobs');
    const snapshot = await getDocs(archivedCol);
    const jobs = [];
    snapshot.forEach((docSnap) => {
      jobs.push({ ...docSnap.data(), id: docSnap.id });
    });
    return jobs;
  } catch (error) {
    console.error(`Error fetching archives for ${dateKey}:`, error);
    return [];
  }
}

/**
 * Fetch all available EOD report dates (for the archive viewer date picker).
 */
export async function fetchAllClosedDates() {
  try {
    const docSnap = await getDoc(doc(db, 'eodReports', '_closedDates'));
    if (docSnap.exists()) {
      return docSnap.data().dates || [];
    }
    return [];
  } catch (error) {
    console.error('Error fetching closed dates:', error);
    return [];
  }
}

/**
 * Fetch all archived jobs across all dates (for filtering/searching).
 * NOTE: This reads from multiple subcollections — use sparingly.
 */
export async function fetchAllArchivedJobs() {
  const dates = await fetchAllClosedDates();
  const allJobs = [];
  for (const dateStr of dates) {
    // Convert "MM/dd/yyyy" to "yyyy-MM-dd" key format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const dateKey = `${parts[2]}-${parts[0]}-${parts[1]}`;
      const jobs = await fetchArchivedJobsByDate(dateKey);
      allJobs.push(...jobs);
    }
  }
  return allJobs;
}
