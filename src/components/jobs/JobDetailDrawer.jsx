import { useState, useEffect, useMemo } from 'react';
import { X, Trash2, Save, Hash, ClipboardList, Ban, History } from 'lucide-react';
import { format } from 'date-fns';
import { useUIStore } from '../../stores/uiStore';
import { useJobsStore, getMechanicWorkStatus } from '../../stores/jobsStore';
import { JOB_STATUSES, STATUS_LABELS } from '../../data/rosters';
import { useAdminStore, getMechanicDisplay } from '../../stores/adminStore';
import MechanicBandwidthWarning from './MechanicBandwidthWarning';

export default function JobDetailDrawer() {
  const editingJobId = useUIStore((s) => s.editingJobId);
  const setEditingJobId = useUIStore((s) => s.setEditingJobId);
  const jobs = useJobsStore((s) => s.jobs);
  const mechanics = useAdminStore((s) => s.mechanics);
  const frontDesk = useAdminStore((s) => s.frontDesk);
  const serviceCategories = useAdminStore((s) => s.serviceCategories);
  const updateJob = useJobsStore((s) => s.updateJob);
  const deleteJob = useJobsStore((s) => s.deleteJob);
  const togglePartsOrdered = useJobsStore((s) => s.togglePartsOrdered);
  const setCancelingJobId = useUIStore((s) => s.setCancelingJobId);
  const openVehicleHistory = useUIStore((s) => s.openVehicleHistory);

  const job = jobs.find((j) => j.id === editingJobId);
  const [form, setForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);

  useEffect(() => {
    if (job) {
      setForm({
        customerName: job.customerName,
        phoneNumber: job.phoneNumber,
        year: job.year,
        make: job.make,
        model: job.model,
        vin: job.vin || '',
        plateNumber: job.plateNumber || '',
        odometerReading: job.odometerReading || '',
        reasonForVisit: Array.isArray(job.reasonForVisit) ? job.reasonForVisit : (job.reasonForVisit ? [job.reasonForVisit] : []),
        frontDeskLead: job.frontDeskLead,
        assignedMechanic: job.assignedMechanic || '',
        assistantMechanic: job.assistantMechanic || '',
        appointmentDate: job.appointmentDate
          ? (() => {
              const parts = job.appointmentDate.split('/');
              return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
            })()
          : '',
        preferredTime: job.preferredTime || '',
        estimatedManHours: job.estimatedManHours || '',
        estimatedCompletion: job.estimatedCompletion || '',
        status: job.status,
        internalNotes: job.internalNotes || '',
      });
      setConfirmDelete(false);
    }
  }, [job]);

  // Close on Escape key (but not when service modal is open)
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && !serviceModalOpen) setEditingJobId(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [serviceModalOpen, setEditingJobId]);

  // Enrich mechanics with work status for dropdown labels + sorting
  const enrichedMechanics = useMemo(() => {
    return mechanics.map((m) => ({
      ...m,
      workStatus: getMechanicWorkStatus(m.name, jobs),
    })).sort((a, b) => {
      if (a.workStatus.status === 'available' && b.workStatus.status === 'busy') return -1;
      if (a.workStatus.status === 'busy' && b.workStatus.status === 'available') return 1;
      return 0;
    });
  }, [mechanics, jobs]);

  // Assistant mechanics: exclude lead from list
  const assistantOptions = useMemo(() => {
    if (!form.assignedMechanic) return [];
    return enrichedMechanics.filter((m) => m.name !== form.assignedMechanic);
  }, [form.assignedMechanic, enrichedMechanics]);

  if (!job) return null;

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleLeadChange = (e) => {
    const val = e.target.value;
    setForm((f) => ({
      ...f,
      assignedMechanic: val,
      assistantMechanic: f.assistantMechanic === val ? '' : f.assistantMechanic,
    }));
  };

  const handleSave = () => {
    let appointmentDate = null;
    if (form.appointmentDate) {
      appointmentDate = format(new Date(form.appointmentDate + 'T00:00:00'), 'MM/dd/yyyy');
    }
    updateJob(job.id, {
      ...form,
      appointmentDate,
      preferredTime: form.preferredTime || null,
      estimatedManHours: form.estimatedManHours
        ? parseFloat(form.estimatedManHours)
        : null,
      estimatedCompletion: form.estimatedCompletion || null,
    });
    setEditingJobId(null);
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteJob(job.id);
    setEditingJobId(null);
  };

  const inputCls =
    'w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={() => setEditingJobId(null)} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col animate-slide-in">
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between shrink-0 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              {job.queueNumber && (
                <span className="inline-flex items-center gap-1 text-xs font-bold bg-blue-600 dark:bg-blue-500 text-white px-2 py-0.5 rounded-md font-mono tracking-wide">
                  <Hash className="w-3 h-3" />
                  {job.queueNumber}
                </span>
              )}
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {job.year} {job.make} {job.model}
              </h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Received: {job.dateReceived}
            </p>
          </div>
          <button
            onClick={() => setEditingJobId(null)}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Cancelled banner */}
          {job.isCanceled && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-700 space-y-2">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-700 dark:text-red-300">CANCELLED</p>
                  {job.canceledAt && (
                    <p className="text-xs text-red-500 dark:text-red-400">Cancelled at {job.canceledAt}</p>
                  )}
                </div>
              </div>
              {job.cancelReason && (
                <div className="ml-7">
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-0.5">Reason:</p>
                  <p className="text-xs text-red-500 dark:text-red-400 leading-relaxed">{job.cancelReason}</p>
                </div>
              )}
            </div>
          )}

          {/* Status */}
          <div>
            <label className={labelCls}>Status</label>
            <select value={form.status} onChange={set('status')} className={inputCls}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Customer Name</label>
              <input type="text" value={form.customerName} onChange={set('customerName')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input type="text" value={form.phoneNumber} onChange={set('phoneNumber')} className={inputCls} />
            </div>
          </div>

          {/* Vehicle */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Year</label>
              <input type="text" value={form.year} onChange={set('year')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Make</label>
              <input type="text" value={form.make} onChange={set('make')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Model</label>
              <input type="text" value={form.model} onChange={set('model')} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>VIN</label>
              <input type="text" value={form.vin} onChange={set('vin')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Plate Number</label>
              <input type="text" value={form.plateNumber} onChange={set('plateNumber')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Odometer</label>
              <input
                type="text"
                value={form.odometerReading}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9,]/g, '');
                  setForm((f) => ({ ...f, odometerReading: val }));
                }}
                placeholder="e.g. 45,230"
                className={inputCls}
              />
            </div>
          </div>

          {/* Reason for Visit — Service Checklist (popup trigger) */}
          <div>
            <label className={labelCls}>Reason for Visit</label>
            <button
              type="button"
              onClick={() => setServiceModalOpen(true)}
              className={`w-full px-4 py-3 rounded-lg border-2 border-dashed text-sm font-medium transition-all flex items-center gap-3 ${
                form.reasonForVisit && form.reasonForVisit.length > 0
                  ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/50'
                  : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <ClipboardList className="w-5 h-5 shrink-0" />
              {form.reasonForVisit && form.reasonForVisit.length > 0 ? (
                <span>{form.reasonForVisit.length} service{form.reasonForVisit.length !== 1 ? 's' : ''} selected — Click to edit</span>
              ) : (
                <span>Click to Select Services</span>
              )}
            </button>
            {form.reasonForVisit && form.reasonForVisit.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {form.reasonForVisit.map((svc) => (
                  <span key={svc} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-[10px] font-medium">
                    {svc}
                    <button
                      type="button"
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          reasonForVisit: f.reasonForVisit.filter((s) => s !== svc),
                        }));
                      }}
                      className="text-blue-400 hover:text-red-500 ml-0.5"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Assignment — dual mechanic */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Front Desk Lead</label>
              <select value={form.frontDeskLead} onChange={set('frontDeskLead')} className={inputCls}>
                <option value="">Select...</option>
                {frontDesk.map((p) => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Lead Mechanic</label>
              <select value={form.assignedMechanic} onChange={handleLeadChange} className={inputCls}>
                <option value="">Unassigned</option>
                {enrichedMechanics.map((m) => (
                  <option key={m.id} value={m.name} disabled={m.workStatus.status === 'busy'}>
                    {getMechanicDisplay(m)}{m.workStatus.label ? ` (${m.workStatus.label})` : ''}{m.workStatus.status === 'busy' ? ' — Busy' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Assistant Mechanic</label>
              <select
                value={form.assistantMechanic}
                onChange={set('assistantMechanic')}
                className={inputCls}
                disabled={!form.assignedMechanic}
              >
                <option value="">None</option>
                {assistantOptions.map((m) => (
                  <option key={m.id} value={m.name} disabled={m.workStatus.status === 'busy'}>
                    {getMechanicDisplay(m)}{m.workStatus.label ? ` (${m.workStatus.label})` : ''}{m.workStatus.status === 'busy' ? ' — Busy' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Scheduling */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Appointment Date</label>
              <input type="date" value={form.appointmentDate} onChange={set('appointmentDate')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Preferred Time</label>
              <select value={form.preferredTime} onChange={set('preferredTime')} className={inputCls}>
                <option value="">Select time...</option>
                {Array.from({ length: 19 }, (_, i) => {
                  const hour = 8 + Math.floor(i / 2);
                  const min = i % 2 === 0 ? '00' : '30';
                  const val = `${String(hour).padStart(2, '0')}:${min}`;
                  const h12 = hour > 12 ? hour - 12 : hour;
                  const ampm = hour >= 12 ? 'PM' : 'AM';
                  return (
                    <option key={val} value={val}>
                      {h12}:{min} {ampm}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Est. Man-Hours</label>
              <input type="number" step="0.5" min="0" value={form.estimatedManHours} onChange={set('estimatedManHours')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Est. Completion</label>
              <input type="time" value={form.estimatedCompletion} onChange={set('estimatedCompletion')} className={inputCls} />
            </div>
          </div>

          {/* Mechanic bandwidth warnings — both lead and assistant */}
          {form.assignedMechanic && form.appointmentDate && (
            <MechanicBandwidthWarning
              mechanicName={form.assignedMechanic}
              appointmentDate={(() => {
                try {
                  return format(new Date(form.appointmentDate + 'T00:00:00'), 'MM/dd/yyyy');
                } catch { return null; }
              })()}
              estimatedManHours={form.estimatedManHours}
              excludeJobId={job.id}
              label="Lead"
            />
          )}
          {form.assistantMechanic && form.appointmentDate && (
            <MechanicBandwidthWarning
              mechanicName={form.assistantMechanic}
              appointmentDate={(() => {
                try {
                  return format(new Date(form.appointmentDate + 'T00:00:00'), 'MM/dd/yyyy');
                } catch { return null; }
              })()}
              estimatedManHours={form.estimatedManHours}
              excludeJobId={job.id}
              label="Assistant"
            />
          )}

          {/* Parts toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Parts Ordered
            </span>
            <button
              onClick={() => togglePartsOrdered(job.id)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                job.partsOrdered ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  job.partsOrdered ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Internal Notes</label>
            <textarea value={form.internalNotes} onChange={set('internalNotes')} rows={2} className={inputCls} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            {/* Cancel Intake — only for WAITLIST non-cancelled */}
            {job.status === JOB_STATUSES.WAITLIST && !job.isCanceled && (
              <button
                onClick={() => {
                  setCancelingJobId(job.id);
                  setEditingJobId(null);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50"
              >
                <Ban className="w-4 h-4" />
                Cancel Intake
              </button>
            )}
            {job.plateNumber && (
              <button
                onClick={() => openVehicleHistory(job.plateNumber)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 hover:bg-violet-100 dark:hover:bg-violet-950/50"
              >
                <History className="w-4 h-4" />
                View History
              </button>
            )}
            <button
              onClick={handleDelete}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                confirmDelete
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              {confirmDelete ? 'Confirm Delete' : 'Delete'}
            </button>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setEditingJobId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Service Checklist Popup Modal */}
      {serviceModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setServiceModalOpen(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col animate-slide-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Select Services
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {form.reasonForVisit?.length || 0} service{(form.reasonForVisit?.length || 0) !== 1 ? 's' : ''} selected
                </p>
              </div>
              <button
                type="button"
                onClick={() => setServiceModalOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body — Checkbox Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {serviceCategories.map((cat) => (
                  <div key={cat.name} className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide border-b-2 border-gray-200 dark:border-gray-700 pb-1.5">
                      {cat.name}
                    </h4>
                    {cat.items.map((item) => {
                      const isChecked = form.reasonForVisit?.includes(item);
                      return (
                        <label
                          key={`edit-svc-${cat.name}-${item}`}
                          className={`flex items-start gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 ring-1 ring-blue-200 dark:ring-blue-700'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setForm((f) => {
                                const current = new Set(f.reasonForVisit || []);
                                if (current.has(item)) {
                                  current.delete(item);
                                } else {
                                  current.add(item);
                                }
                                return { ...f, reasonForVisit: [...current] };
                              });
                            }}
                            className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 shrink-0"
                          />
                          <span className="text-sm leading-snug">{item}</span>
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {form.reasonForVisit?.length > 0 ? (
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    {form.reasonForVisit.length} selected
                  </span>
                ) : (
                  'No services selected'
                )}
              </p>
              <button
                type="button"
                onClick={() => setServiceModalOpen(false)}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
              >
                Confirm Selection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
