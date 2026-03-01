import { useState, useEffect } from 'react';
import { AlertTriangle, X, Ban, Hash, User, Car } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useJobsStore } from '../../stores/jobsStore';

const CANCEL_REASONS = [
  'Customer left / Wait time too long',
  'Customer declined the price/estimate',
  'Parts unavailable / Backordered',
  'Shop cannot perform the requested service',
  'Customer resolved the issue / Changed mind',
  'Duplicate entry / Front desk error',
];

export default function CancelIntakeModal() {
  const cancelingJobId = useUIStore((s) => s.cancelingJobId);
  const setCancelingJobId = useUIStore((s) => s.setCancelingJobId);
  const jobs = useJobsStore((s) => s.jobs);
  const cancelJob = useJobsStore((s) => s.cancelJob);

  const job = jobs.find((j) => j.id === cancelingJobId);

  const [selectedReasons, setSelectedReasons] = useState([]);
  const [otherChecked, setOtherChecked] = useState(false);
  const [otherText, setOtherText] = useState('');
  const [showError, setShowError] = useState(false);

  // Reset form state when modal opens/closes
  useEffect(() => {
    if (cancelingJobId) {
      setSelectedReasons([]);
      setOtherChecked(false);
      setOtherText('');
      setShowError(false);
    }
  }, [cancelingJobId]);

  if (!cancelingJobId || !job) return null;

  const hasSelection = selectedReasons.length > 0 || otherChecked;
  const otherValid = !otherChecked || otherText.trim().length > 0;
  const isValid = hasSelection && otherValid;

  const toggleReason = (reason) => {
    setShowError(false);
    setSelectedReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  };

  const handleOtherToggle = () => {
    setShowError(false);
    setOtherChecked((prev) => !prev);
    if (otherChecked) setOtherText('');
  };

  const handleClose = () => {
    setCancelingJobId(null);
  };

  const handleConfirm = () => {
    if (!isValid) {
      setShowError(true);
      return;
    }

    // Build the reason string
    const reasons = [...selectedReasons];
    if (otherChecked && otherText.trim()) {
      reasons.push(`Other: ${otherText.trim()}`);
    }
    const reasonString = reasons.join('; ');

    cancelJob(job.id, reasonString);
    setCancelingJobId(null);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 animate-slide-in">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-full bg-red-100 dark:bg-red-950/50 shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Cancel this Intake?
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                This action will move the job to DONE as cancelled.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Job Details */}
        <div className="mx-6 mb-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 space-y-2">
          {job.queueNumber && (
            <div className="flex items-center gap-2">
              <Hash className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono tracking-wide">
                {job.queueNumber}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Car className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {job.year} {job.make} {job.model}
            </span>
          </div>
          {job.plateNumber && (
            <div className="flex items-center gap-2 ml-5.5">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                Plate: {job.plateNumber}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {job.customerName}
            </span>
          </div>
        </div>

        {/* Reason for Cancellation */}
        <div className="px-6 pb-2">
          <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Reason for Cancellation <span className="text-red-500">*</span>
          </label>

          <div className="space-y-2">
            {CANCEL_REASONS.map((reason) => {
              const isChecked = selectedReasons.includes(reason);
              return (
                <label
                  key={reason}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all border ${
                    isChecked
                      ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                      : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleReason(reason)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-red-600 focus:ring-red-500 shrink-0"
                  />
                  <span className="text-sm leading-snug">{reason}</span>
                </label>
              );
            })}

            {/* Other option */}
            <label
              className={`flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all border ${
                otherChecked
                  ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                  : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={otherChecked}
                onChange={handleOtherToggle}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-red-600 focus:ring-red-500 shrink-0"
              />
              <span className="text-sm leading-snug">Other (Please specify)</span>
            </label>

            {/* Other text input */}
            {otherChecked && (
              <div className="ml-7 mt-1">
                <input
                  type="text"
                  value={otherText}
                  onChange={(e) => { setOtherText(e.target.value); setShowError(false); }}
                  placeholder="Please specify the reason..."
                  autoFocus
                  className={`w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 ${
                    showError && otherChecked && !otherText.trim()
                      ? 'border-red-400 dark:border-red-600 focus:ring-red-500'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-red-500'
                  }`}
                />
                {showError && otherChecked && !otherText.trim() && (
                  <p className="text-xs text-red-500 mt-1">Please specify the reason.</p>
                )}
              </div>
            )}
          </div>

          {/* Validation error */}
          {showError && !hasSelection && (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Please select at least one reason for cancellation.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-gray-200 dark:border-gray-700 mt-4">
          <button
            onClick={handleClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={handleConfirm}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors shadow-md ${
              isValid
                ? 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800'
                : 'bg-red-300 dark:bg-red-900 text-red-100 dark:text-red-400 cursor-not-allowed'
            }`}
          >
            <Ban className="w-4 h-4" />
            Confirm Cancellation
          </button>
        </div>
      </div>
    </div>
  );
}
