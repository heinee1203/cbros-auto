import { useMemo } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { useJobsStore, isMechanicOnJob } from '../../stores/jobsStore';

/**
 * Shows a warning when the selected mechanic would exceed 8 hours on the given date.
 * Now checks BOTH lead and assistant mechanic fields for existing hours.
 * Props: mechanicName, appointmentDate (MM/dd/yyyy), estimatedManHours, excludeJobId (optional), label (optional)
 */
export default function MechanicBandwidthWarning({ mechanicName, appointmentDate, estimatedManHours, excludeJobId, label }) {
  const jobs = useJobsStore((s) => s.jobs);

  const warning = useMemo(() => {
    if (!mechanicName || !appointmentDate) return null;

    const existingHours = jobs
      .filter(
        (j) =>
          isMechanicOnJob(j, mechanicName) &&
          j.appointmentDate === appointmentDate &&
          j.estimatedManHours &&
          j.id !== excludeJobId
      )
      .reduce((sum, j) => sum + (j.estimatedManHours || 0), 0);

    const newHours = parseFloat(estimatedManHours) || 0;
    const totalHours = existingHours + newHours;

    if (totalHours > 8) {
      return { existingHours, newHours, totalHours };
    }
    if (existingHours > 0) {
      return { existingHours, newHours, totalHours, info: true };
    }
    return null;
  }, [mechanicName, appointmentDate, estimatedManHours, excludeJobId, jobs]);

  if (!warning) return null;

  const isOverload = warning.totalHours > 8;
  const roleLabel = label ? ` (${label})` : '';

  return (
    <div
      className={`flex items-start gap-2 p-2.5 rounded-lg text-xs mt-2 ${
        isOverload
          ? 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          : 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
      }`}
    >
      {isOverload ? (
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      ) : (
        <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      )}
      <div>
        {isOverload ? (
          <>
            <span className="font-semibold">Over 8 hours!</span>{' '}
            {mechanicName}{roleLabel} will have {warning.totalHours}h assigned on {appointmentDate}
            {warning.existingHours > 0 && (
              <span className="block mt-0.5 opacity-80">
                (Existing: {warning.existingHours}h + This job: {warning.newHours}h)
              </span>
            )}
          </>
        ) : (
          <>
            {mechanicName}{roleLabel} has {warning.existingHours}h already assigned on {appointmentDate}.
            {warning.newHours > 0 && <> Total will be {warning.totalHours}h.</>}
          </>
        )}
      </div>
    </div>
  );
}
