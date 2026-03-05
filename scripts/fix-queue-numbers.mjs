/**
 * One-time migration script: Fix queue numbers for all existing jobs in Firestore.
 *
 * Rules:
 *   1. Format: MMDD-NN (e.g., 0305-01)
 *   2. Date prefix:
 *      - Use appointmentDate (MM/dd/yyyy) if it exists
 *      - Otherwise use dateReceived (MM/dd/yyyy)
 *      - Fallback to createdAt (ISO) date portion
 *   3. Within each MMDD group, sort by createdAt ascending, number from -01
 *   4. Skip done jobs (READY_FOR_PICKUP, DONE, isCanceled)
 *   5. Only process jobs from March 6, 2026 onwards
 *
 * Usage:
 *   node scripts/fix-queue-numbers.mjs          # dry-run (preview only)
 *   node scripts/fix-queue-numbers.mjs --apply  # actually write changes
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

// Firebase config (same as .env)
const firebaseConfig = {
  apiKey: 'AIzaSyBmDsCxhmq5qrvQDESGcZTrV8Zs-ZYmOS0',
  authDomain: 'cbros-auto.firebaseapp.com',
  projectId: 'cbros-auto',
  storageBucket: 'cbros-auto.firebasestorage.app',
  messagingSenderId: '1075024561561',
  appId: '1:1075024561561:web:24335e6a6094f0549dbf08',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ACTIVE_JOBS_COL = 'activeJobs';
const applyChanges = process.argv.includes('--apply');

// Cutoff: only process jobs from March 6, 2026 onwards
const CUTOFF_DATE = '0306'; // MMDD format

// Done statuses to skip
const DONE_STATUSES = ['READY_FOR_PICKUP', 'DONE'];

/**
 * Extract MMDD prefix from a date string in MM/dd/yyyy format.
 */
function dateToPrefix(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{2})\/(\d{2})\/\d{4}$/);
  return m ? m[1] + m[2] : null;
}

/**
 * Extract MMDD prefix from an ISO date string (createdAt).
 */
function isoToPrefix(isoStr) {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return mm + dd;
  } catch {
    return null;
  }
}

async function main() {
  console.log(`\n=== Queue Number Migration ${applyChanges ? '(APPLY MODE)' : '(DRY RUN)'} ===\n`);

  // Fetch all documents from activeJobs
  const snapshot = await getDocs(collection(db, ACTIVE_JOBS_COL));
  const jobs = [];

  snapshot.forEach((docSnap) => {
    const id = docSnap.id;
    // Skip internal counter/meta documents
    if (id === '_queueCounter' || id.startsWith('_qc_') || id === '_closedDates') return;
    jobs.push({ id, ...docSnap.data() });
  });

  console.log(`Found ${jobs.length} job(s) in activeJobs.\n`);

  if (jobs.length === 0) {
    console.log('No jobs to process. Exiting.');
    process.exit(0);
  }

  console.log(`Total jobs in activeJobs: ${jobs.length}`);

  // Filter out done/canceled jobs and jobs before cutoff date
  const skipped = [];
  const eligible = [];

  for (const job of jobs) {
    const isDone = DONE_STATUSES.includes(job.status) || job.isCanceled || job.isDone;
    const prefix =
      dateToPrefix(job.appointmentDate) ||
      dateToPrefix(job.dateReceived) ||
      isoToPrefix(job.createdAt) ||
      '0000';

    if (isDone) {
      skipped.push({ ...job, _prefix: prefix, _reason: 'done/canceled' });
    } else if (prefix < CUTOFF_DATE) {
      skipped.push({ ...job, _prefix: prefix, _reason: `before ${CUTOFF_DATE}` });
    } else {
      eligible.push({ ...job, _prefix: prefix });
    }
  }

  console.log(`Eligible for renumbering: ${eligible.length}`);
  console.log(`Skipped: ${skipped.length} (${skipped.filter(s => s._reason.includes('done')).length} done/canceled, ${skipped.filter(s => s._reason.includes('before')).length} before cutoff)\n`);

  if (skipped.length > 0) {
    console.log('─── Skipped Jobs ───');
    for (const s of skipped) {
      console.log(`  ${(s.queueNumber || '(none)').padEnd(12)} ${(s.customerName || '').slice(0, 20).padEnd(22)} ${s._reason}`);
    }
    console.log('');
  }

  // Group eligible jobs by prefix
  const groups = {};
  for (const job of eligible) {
    if (!groups[job._prefix]) groups[job._prefix] = [];
    groups[job._prefix].push(job);
  }

  // Within each group, sort by createdAt ascending, then assign sequential numbers
  const changes = []; // { id, oldQueueNumber, newQueueNumber }

  for (const [prefix, groupJobs] of Object.entries(groups).sort()) {
    // Sort by createdAt (ISO string) ascending
    groupJobs.sort((a, b) => {
      const tA = a.createdAt || '';
      const tB = b.createdAt || '';
      return tA.localeCompare(tB);
    });

    groupJobs.forEach((job, idx) => {
      const newQN = `${prefix}-${String(idx + 1).padStart(2, '0')}`;
      changes.push({
        id: job.id,
        customerName: job.customerName || '(no name)',
        vehicle: [job.year, job.make, job.model].filter(Boolean).join(' ') || '(no vehicle)',
        appointmentDate: job.appointmentDate || '-',
        dateReceived: job.dateReceived || '-',
        createdAt: job.createdAt || '-',
        oldQueueNumber: job.queueNumber || '(none)',
        newQueueNumber: newQN,
        changed: (job.queueNumber || '') !== newQN,
      });
    });
  }

  // Show Before vs After preview (first 10)
  console.log('─── Before vs. After Preview (first 10 jobs) ───\n');
  console.log(
    'No.'.padEnd(5) +
    'Old Queue #'.padEnd(15) +
    'New Queue #'.padEnd(15) +
    'Changed'.padEnd(10) +
    'Customer'.padEnd(22) +
    'Vehicle'.padEnd(30) +
    'Appt Date'.padEnd(14) +
    'Date Received'
  );
  console.log('─'.repeat(125));

  const preview = changes.slice(0, 10);
  preview.forEach((c, i) => {
    console.log(
      String(i + 1).padEnd(5) +
      c.oldQueueNumber.padEnd(15) +
      c.newQueueNumber.padEnd(15) +
      (c.changed ? 'YES' : 'no').padEnd(10) +
      c.customerName.slice(0, 20).padEnd(22) +
      c.vehicle.slice(0, 28).padEnd(30) +
      c.appointmentDate.padEnd(14) +
      c.dateReceived
    );
  });

  if (changes.length > 10) {
    console.log(`\n... and ${changes.length - 10} more job(s).`);
  }

  // Summary
  const totalChanged = changes.filter((c) => c.changed).length;
  const totalUnchanged = changes.length - totalChanged;
  console.log(`\n─── Summary ───`);
  console.log(`Total jobs:     ${changes.length}`);
  console.log(`Will change:    ${totalChanged}`);
  console.log(`Already correct: ${totalUnchanged}`);

  // Show all groups
  const groupSummary = {};
  for (const c of changes) {
    const prefix = c.newQueueNumber.split('-')[0];
    groupSummary[prefix] = (groupSummary[prefix] || 0) + 1;
  }
  console.log(`\nGroups: ${Object.entries(groupSummary).sort().map(([k, v]) => `${k} (${v} jobs)`).join(', ')}`);

  if (!applyChanges) {
    console.log(`\n>>> DRY RUN complete. To apply changes, run:`);
    console.log(`    node scripts/fix-queue-numbers.mjs --apply\n`);
    process.exit(0);
  }

  // Apply changes in batches (Firestore limit: 500 writes per batch)
  console.log(`\nApplying ${totalChanged} change(s) to Firestore...`);
  const toUpdate = changes.filter((c) => c.changed);
  const BATCH_SIZE = 450;

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const slice = toUpdate.slice(i, i + BATCH_SIZE);
    for (const c of slice) {
      batch.update(doc(db, ACTIVE_JOBS_COL, c.id), { queueNumber: c.newQueueNumber });
    }
    await batch.commit();
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: updated ${slice.length} job(s).`);
  }

  // Also update the per-date counter documents to match
  console.log('\nUpdating per-date counter documents...');
  const counterBatch = writeBatch(db);
  for (const [prefix, count] of Object.entries(groupSummary)) {
    const counterRef = doc(db, ACTIVE_JOBS_COL, `_qc_${prefix}`);
    counterBatch.set(counterRef, { seq: count });
  }
  await counterBatch.commit();
  console.log(`  Updated ${Object.keys(groupSummary).length} counter doc(s).`);

  console.log('\nDone! All queue numbers have been updated.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
