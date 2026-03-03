import { useEffect, useState, useRef } from 'react';
import { useJobsStore } from '../stores/jobsStore';
import { useAdminStore, DEFAULT_MECHANICS, DEFAULT_FRONT_DESK, DEFAULT_SETTINGS } from '../stores/adminStore';
import { subscribeToActiveJobs } from '../services/firestoreJobs';
import { subscribeToPersonnel, seedPersonnelDefaults } from '../services/firestorePersonnel';
import { subscribeToClosedDates } from '../services/firestoreEOD';
import { DEFAULT_SERVICE_CATEGORIES } from '../data/rosters';

/**
 * FirebaseSyncProvider — wraps the app and connects Firestore real-time
 * listeners to Zustand stores. Shows a loading screen until initial data loads.
 */
export default function FirebaseSyncProvider({ children }) {
  const [jobsReady, setJobsReady] = useState(false);
  const [personnelReady, setPersonnelReady] = useState(false);
  const [closedDatesReady, setClosedDatesReady] = useState(false);
  const [error, setError] = useState(null);
  const seededRef = useRef(false);

  useEffect(() => {
    // ── 1. Subscribe to active jobs ────────────────────────────────────
    const unsubJobs = subscribeToActiveJobs((jobs) => {
      useJobsStore.getState()._setJobsFromFirestore(jobs);
      setJobsReady(true);
    });

    // ── 2. Subscribe to personnel ──────────────────────────────────────
    const unsubPersonnel = subscribeToPersonnel(async (data) => {
      // If no personnel data exists in Firestore, seed defaults (first run)
      const hasData = data.mechanics || data.frontDesk || data.settings;
      if (!hasData && !seededRef.current) {
        seededRef.current = true;
        try {
          await seedPersonnelDefaults({
            mechanics: DEFAULT_MECHANICS,
            frontDesk: DEFAULT_FRONT_DESK,
            settings: DEFAULT_SETTINGS,
            serviceCategories: DEFAULT_SERVICE_CATEGORIES,
          });
          console.log('Seeded default personnel data to Firestore');
        } catch (err) {
          console.error('Failed to seed personnel defaults:', err);
          setError('Failed to initialize personnel data');
        }
      } else if (hasData) {
        useAdminStore.getState()._setFromFirestore(data);
      }
      setPersonnelReady(true);
    });

    // ── 3. Subscribe to closed dates ───────────────────────────────────
    const unsubClosedDates = subscribeToClosedDates((dates) => {
      useJobsStore.getState()._setClosedDatesFromFirestore(dates);
      setClosedDatesReady(true);
    });

    // Cleanup on unmount
    return () => {
      unsubJobs();
      unsubPersonnel();
      unsubClosedDates();
    };
  }, []);

  const isReady = jobsReady && personnelReady && closedDatesReady;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center space-y-4 p-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Connection Error</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-blue-200 dark:border-blue-800" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 dark:border-t-blue-400 animate-spin" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">CBROS Auto</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Connecting to database...</p>
          </div>
          <div className="flex items-center justify-center gap-3 text-xs text-gray-400 dark:text-gray-500">
            <span className={jobsReady ? 'text-emerald-500' : ''}>
              {jobsReady ? '✓' : '○'} Jobs
            </span>
            <span className={personnelReady ? 'text-emerald-500' : ''}>
              {personnelReady ? '✓' : '○'} Personnel
            </span>
            <span className={closedDatesReady ? 'text-emerald-500' : ''}>
              {closedDatesReady ? '✓' : '○'} Schedule
            </span>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
