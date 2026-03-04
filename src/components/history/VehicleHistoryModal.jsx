import { useState, useEffect, useMemo } from 'react';
import { X, Search, Loader2, Inbox, History, Ban } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useJobsStore } from '../../stores/jobsStore';
import { useAdminStore, getMechanicDisplay } from '../../stores/adminStore';
import { JOB_STATUSES, STATUS_LABELS } from '../../data/rosters';
import { fetchAllArchivedJobs } from '../../services/firestoreEOD';

const STATUS_BADGE_COLORS = {
  [JOB_STATUSES.WAITLIST]: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  [JOB_STATUSES.IN_SERVICE]: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  [JOB_STATUSES.AWAITING_PARTS]: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
  [JOB_STATUSES.READY_FOR_PICKUP]: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
  [JOB_STATUSES.DONE]: 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300',
};

export default function VehicleHistoryModal() {
  const vehicleHistoryOpen = useUIStore((s) => s.vehicleHistoryOpen);
  const vehicleHistoryPlate = useUIStore((s) => s.vehicleHistoryPlate);
  const closeVehicleHistory = useUIStore((s) => s.closeVehicleHistory);
  const activeJobs = useJobsStore((s) => s.jobs);
  const mechanics = useAdminStore((s) => s.mechanics);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchMode, setSearchMode] = useState('plate'); // 'plate' | 'cs'
  const [archivedJobsCache, setArchivedJobsCache] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveLoaded, setArchiveLoaded] = useState(false);

  // Sync pre-fill plate when modal opens
  useEffect(() => {
    if (vehicleHistoryOpen) {
      if (vehicleHistoryPlate) {
        setSearchTerm(vehicleHistoryPlate);
        setSearchMode('plate');
      } else {
        setSearchTerm('');
      }
      // Fetch archived jobs once on open
      if (!archiveLoaded) {
        setArchiveLoading(true);
        fetchAllArchivedJobs()
          .then((jobs) => {
            setArchivedJobsCache(jobs);
            setArchiveLoaded(true);
          })
          .catch((err) => {
            console.error('Failed to fetch archived jobs:', err);
          })
          .finally(() => setArchiveLoading(false));
      }
    }
  }, [vehicleHistoryOpen]);

  // Reset cache when modal closes so next open re-fetches fresh data
  useEffect(() => {
    if (!vehicleHistoryOpen) {
      setArchiveLoaded(false);
      setArchivedJobsCache([]);
    }
  }, [vehicleHistoryOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!vehicleHistoryOpen) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') closeVehicleHistory();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [vehicleHistoryOpen, closeVehicleHistory]);

  // Filter and sort results
  const results = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];

    // Combine active + archived
    const allJobs = [...activeJobs, ...archivedJobsCache];

    // De-duplicate by ID
    const seen = new Set();
    const deduped = allJobs.filter((job) => {
      if (seen.has(job.id)) return false;
      seen.add(job.id);
      return true;
    });

    // Filter by search mode
    const matched = deduped.filter((job) => {
      if (searchMode === 'plate') {
        return (job.plateNumber || '').toLowerCase().includes(query);
      } else {
        return (job.queueNumber || '').toLowerCase().includes(query);
      }
    });

    // Sort by dateReceived (newest first)
    matched.sort((a, b) => {
      const parseDate = (str) => {
        if (!str) return 0;
        const parts = str.split('/');
        if (parts.length !== 3) return 0;
        return new Date(parts[2], parts[0] - 1, parts[1]).getTime();
      };
      return parseDate(b.dateReceived) - parseDate(a.dateReceived);
    });

    return matched;
  }, [searchTerm, searchMode, activeJobs, archivedJobsCache]);

  const getStatusBadge = (job) => {
    if (job.isCanceled) {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 whitespace-nowrap">
          <Ban className="w-2.5 h-2.5" />
          Cancelled
        </span>
      );
    }
    const colorCls = STATUS_BADGE_COLORS[job.status] || 'bg-gray-100 text-gray-700';
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${colorCls}`}>
        {STATUS_LABELS[job.status] || job.status}
      </span>
    );
  };

  if (!vehicleHistoryOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50" onClick={closeVehicleHistory} />

      {/* Modal panel */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[90vh] flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Vehicle Job History</h2>
          </div>
          <button
            onClick={closeVehicleHistory}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            {/* Mode toggle */}
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden shrink-0">
              <button
                onClick={() => setSearchMode('plate')}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  searchMode === 'plate'
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Plate #
              </button>
              <button
                onClick={() => setSearchMode('cs')}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  searchMode === 'cs'
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                CS #
              </button>
            </div>

            {/* Search input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchMode === 'plate' ? 'Search by plate number...' : 'Search by CS / queue number...'}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                autoFocus
              />
            </div>
          </div>

          {/* Result count */}
          {searchTerm.trim() && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              {archiveLoading
                ? 'Loading archived records...'
                : `${results.length} record${results.length !== 1 ? 's' : ''} found`}
            </p>
          )}
        </div>

        {/* Results area */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading state */}
          {archiveLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p className="text-sm font-medium">Loading archived records...</p>
            </div>
          )}

          {/* Empty state — no search yet */}
          {!searchTerm.trim() && !archiveLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <Search className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">Enter a plate number or CS number to search</p>
              <p className="text-xs mt-1">Results include both active and archived jobs</p>
            </div>
          )}

          {/* Empty state — no results */}
          {searchTerm.trim() && !archiveLoading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <Inbox className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">No records found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          )}

          {/* Results table */}
          {results.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Date</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">CS #</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Vehicle</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Services</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Hours</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Mechanic</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((job) => (
                    <tr
                      key={job.id}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {job.dateReceived || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {job.queueNumber || '—'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {job.year} {job.make} {job.model}
                        </span>
                        {job.plateNumber && (
                          <span className="ml-2 text-[10px] font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                            {job.plateNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 max-w-[220px]">
                        <div className="flex flex-wrap gap-0.5">
                          {(Array.isArray(job.reasonForVisit) ? job.reasonForVisit : []).map((svc, i) => (
                            <span
                              key={`${svc}-${i}`}
                              className="inline-block px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] text-gray-600 dark:text-gray-300"
                            >
                              {svc}
                            </span>
                          ))}
                          {(!job.reasonForVisit || job.reasonForVisit.length === 0) && (
                            <span className="text-gray-300 dark:text-gray-600">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {job.estimatedManHours ? `${job.estimatedManHours}h` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {job.assignedMechanic
                          ? getMechanicDisplay(job.assignedMechanic, mechanics)
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        {getStatusBadge(job)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
