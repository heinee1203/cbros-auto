import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

const PERSONNEL_COL = 'personnel';

/**
 * Subscribe to real-time updates on all personnel documents.
 * Calls callback with a merged object of all personnel data.
 * Returns an unsubscribe function.
 */
export function subscribeToPersonnel(callback) {
  const docIds = ['settings', 'mechanics', 'frontDesk', 'serviceCategories', 'auditLogs'];
  const data = {};
  const unsubscribers = [];

  docIds.forEach((docId) => {
    const unsub = onSnapshot(doc(db, PERSONNEL_COL, docId), (docSnap) => {
      if (docSnap.exists()) {
        data[docId] = docSnap.data();
      }
      // Call with whatever we have so far — provider tracks readiness
      callback({ ...data });
    }, (error) => {
      console.error(`Firestore personnel/${docId} listener error:`, error);
    });
    unsubscribers.push(unsub);
  });

  // Return a single unsubscribe function that cleans up all listeners
  return () => unsubscribers.forEach((unsub) => unsub());
}

/**
 * Update the mechanics list in Firestore.
 */
export async function firestoreUpdateMechanics(mechanics) {
  await setDoc(doc(db, PERSONNEL_COL, 'mechanics'), { list: mechanics });
}

/**
 * Update the front desk list in Firestore.
 */
export async function firestoreUpdateFrontDesk(frontDesk) {
  await setDoc(doc(db, PERSONNEL_COL, 'frontDesk'), { list: frontDesk });
}

/**
 * Update shop settings in Firestore.
 */
export async function firestoreUpdateSettings(settings) {
  await setDoc(doc(db, PERSONNEL_COL, 'settings'), settings);
}

/**
 * Update service categories in Firestore.
 */
export async function firestoreUpdateCategories(categories) {
  await setDoc(doc(db, PERSONNEL_COL, 'serviceCategories'), { categories });
}

/**
 * Update audit logs in Firestore.
 */
export async function firestoreUpdateAuditLogs(logs) {
  await setDoc(doc(db, PERSONNEL_COL, 'auditLogs'), { logs });
}

/**
 * Seed default data into Firestore if the personnel collection is empty.
 * Called on first run.
 */
export async function seedPersonnelDefaults(defaults) {
  const { mechanics, frontDesk, settings, serviceCategories } = defaults;
  await Promise.all([
    firestoreUpdateMechanics(mechanics),
    firestoreUpdateFrontDesk(frontDesk),
    firestoreUpdateSettings(settings),
    firestoreUpdateCategories(serviceCategories),
    firestoreUpdateAuditLogs([]),
  ]);
}
