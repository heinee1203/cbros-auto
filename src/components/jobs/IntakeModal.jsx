import { useState, useEffect, useMemo, useRef } from 'react';
import { X, AlertTriangle, ChevronDown, Footprints, CalendarClock, ClipboardList, CheckCircle2, Hash, Stethoscope } from 'lucide-react';
import { format } from 'date-fns';
import { useUIStore } from '../../stores/uiStore';
import { useJobsStore } from '../../stores/jobsStore';
import { VEHICLE_MAKES, VEHICLE_YEARS } from '../../data/rosters';
import { useAdminStore, getMechanicDisplay } from '../../stores/adminStore';
import MechanicBandwidthWarning from './MechanicBandwidthWarning';

const initialForm = {
  intakeType: 'walk-in',
  customerName: '',
  phoneNumber: '',
  year: '',
  make: '',
  model: '',
  vin: '',
  plateNumber: '',
  odometerReading: '',
  reasonForVisit: [],
  frontDeskLead: '',
  assignedMechanic: '',
  assistantMechanic: '',
  appointmentDate: '',
  preferredTime: '',
  estimatedManHours: '',
  estimatedCompletion: '',
  internalNotes: '',
};

export default function IntakeModal() {
  const { intakeModalOpen, closeIntakeModal, intakePreFill } = useUIStore();
  const addJob = useJobsStore((s) => s.addJob);
  const jobs = useJobsStore((s) => s.jobs);
  const mechanics = useAdminStore((s) => s.mechanics);
  const frontDesk = useAdminStore((s) => s.frontDesk);
  const slotCapacity = useAdminStore((s) => s.slotCapacity);
  const serviceCategories = useAdminStore((s) => s.serviceCategories);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [successData, setSuccessData] = useState(null); // { queueNumber, customerName, vehicle }

  // Real-time clock for past-time slot filtering (ticks every minute)
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const [serviceModalOpen, setServiceModalOpen] = useState(false);

  // Make combobox state
  const [makeDropdownOpen, setMakeDropdownOpen] = useState(false);
  const [makeFilter, setMakeFilter] = useState('');
  const makeInputRef = useRef(null);
  const makeDropdownRef = useRef(null);

  // Apply pre-fill when modal opens from calendar click
  useEffect(() => {
    if (intakeModalOpen && intakePreFill) {
      setForm((f) => ({
        ...f,
        intakeType: 'scheduled',
        appointmentDate: intakePreFill.appointmentDate || '',
        preferredTime: intakePreFill.preferredTime || '',
      }));
    }
    if (!intakeModalOpen) {
      setForm(initialForm);
      setErrors({});
      setSuccessData(null);
      setMakeDropdownOpen(false);
      setMakeFilter('');
      setServiceModalOpen(false);
    }
  }, [intakeModalOpen, intakePreFill]);

  // Close make dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        makeDropdownRef.current &&
        !makeDropdownRef.current.contains(e.target) &&
        makeInputRef.current &&
        !makeInputRef.current.contains(e.target)
      ) {
        setMakeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute slot counts for selected date to show capacity warnings
  const slotCounts = useMemo(() => {
    if (!form.appointmentDate) return {};
    const dateStr = format(new Date(form.appointmentDate + 'T00:00:00'), 'MM/dd/yyyy');
    const counts = {};
    jobs.forEach((j) => {
      if (j.appointmentDate === dateStr && j.preferredTime) {
        counts[j.preferredTime] = (counts[j.preferredTime] || 0) + 1;
      }
    });
    return counts;
  }, [jobs, form.appointmentDate]);

  // Check if the selected appointment date is today
  const isSelectedDateToday = useMemo(() => {
    if (!form.appointmentDate) return false;
    const selected = new Date(form.appointmentDate + 'T00:00:00');
    return (
      selected.getFullYear() === now.getFullYear() &&
      selected.getMonth() === now.getMonth() &&
      selected.getDate() === now.getDate()
    );
  }, [form.appointmentDate, now]);

  // Auto-clear preferred time if it has become past (date changed to today or clock advanced)
  useEffect(() => {
    if (!isSelectedDateToday || !form.preferredTime) return;
    const [h, m] = form.preferredTime.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return;
    const slotEndMinutes = h * 60 + m + 30;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    if (slotEndMinutes <= currentMinutes) {
      setForm((f) => ({ ...f, preferredTime: '' }));
    }
  }, [isSelectedDateToday, now, form.preferredTime]);

  // Filtered makes for combobox
  const filteredMakes = useMemo(() => {
    if (!makeFilter.trim()) return VEHICLE_MAKES;
    const q = makeFilter.toLowerCase();
    return VEHICLE_MAKES.filter((m) => m.toLowerCase().includes(q));
  }, [makeFilter]);

  // Assistant mechanics: exclude lead from list
  const assistantOptions = useMemo(() => {
    if (!form.assignedMechanic) return [];
    return mechanics.filter((m) => m.name !== form.assignedMechanic);
  }, [form.assignedMechanic]);

  // Generate time slots with capacity info and past-time filtering
  const timeSlots = useMemo(() => {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return Array.from({ length: 19 }, (_, i) => {
      const hour = 8 + Math.floor(i / 2);
      const min = i % 2 === 0 ? '00' : '30';
      const val = `${String(hour).padStart(2, '0')}:${min}`;
      const h12 = hour > 12 ? hour - 12 : hour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const count = slotCounts[val] || 0;
      const isFull = count >= slotCapacity;
      // Disable slots whose 30-min window has fully elapsed on today
      const slotEndMinutes = hour * 60 + parseInt(min) + 30;
      const isPast = isSelectedDateToday && slotEndMinutes <= currentMinutes;
      return { val, label: `${h12}:${min} ${ampm}`, count, isFull, isPast };
    });
  }, [slotCounts, slotCapacity, isSelectedDateToday, now]);

  if (!intakeModalOpen) return null;

  const set2 = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors((er) => ({ ...er, [field]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!form.customerName.trim()) errs.customerName = 'Required';
    if (!form.phoneNumber.trim()) errs.phoneNumber = 'Required';
    if (!form.year.trim()) errs.year = 'Required';
    if (!form.make.trim()) errs.make = 'Required';
    if (!form.model.trim()) errs.model = 'Required';
    if (!form.plateNumber.trim()) errs.plateNumber = 'Required';
    if (!form.odometerReading.trim()) errs.odometerReading = 'Required';
    if (!form.reasonForVisit || form.reasonForVisit.length === 0) errs.reasonForVisit = 'Select at least one service';
    if (!form.frontDeskLead) errs.frontDeskLead = 'Required';

    // Check slot capacity
    if (form.appointmentDate && form.preferredTime) {
      const dateStr = format(new Date(form.appointmentDate + 'T00:00:00'), 'MM/dd/yyyy');
      const count = jobs.filter(
        (j) => j.appointmentDate === dateStr && j.preferredTime === form.preferredTime
      ).length;
      if (count >= slotCapacity) {
        errs.preferredTime = `Slot full (${slotCapacity}/${slotCapacity})`;
      }
    }

    // Prevent submitting a past time slot on today's date
    if (form.appointmentDate && form.preferredTime && isSelectedDateToday) {
      const [h, m] = form.preferredTime.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const slotEndMinutes = h * 60 + m + 30;
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        if (slotEndMinutes <= currentMinutes) {
          errs.preferredTime = 'This time slot has already passed';
        }
      }
    }
    return errs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    let appointmentDate = null;
    if (form.appointmentDate) {
      appointmentDate = format(new Date(form.appointmentDate + 'T00:00:00'), 'MM/dd/yyyy');
    }

    const newJobId = addJob({
      ...form,
      appointmentDate,
      preferredTime: form.preferredTime || null,
      estimatedManHours: form.estimatedManHours
        ? parseFloat(form.estimatedManHours)
        : null,
      estimatedCompletion: form.estimatedCompletion || null,
    });

    // Find the newly created job to get its queue number
    const newJob = useJobsStore.getState().jobs.find((j) => j.id === newJobId);
    setSuccessData({
      queueNumber: newJob?.queueNumber || '',
      customerName: form.customerName,
      vehicle: `${form.year} ${form.make} ${form.model}`,
      plateNumber: form.plateNumber,
      services: form.reasonForVisit.length,
    });

    setForm(initialForm);
    setErrors({});
  };

  const handleMakeSelect = (make) => {
    setForm((f) => ({ ...f, make }));
    setMakeFilter('');
    setMakeDropdownOpen(false);
    if (errors.make) setErrors((er) => ({ ...er, make: null }));
  };

  const handleMakeInputChange = (e) => {
    const val = e.target.value;
    setForm((f) => ({ ...f, make: val }));
    setMakeFilter(val);
    setMakeDropdownOpen(true);
    if (errors.make) setErrors((er) => ({ ...er, make: null }));
  };

  // When lead mechanic changes, clear assistant if it matches the new lead
  const handleLeadMechanicChange = (e) => {
    const val = e.target.value;
    setForm((f) => ({
      ...f,
      assignedMechanic: val,
      assistantMechanic: f.assistantMechanic === val ? '' : f.assistantMechanic,
    }));
  };

  const inputCls = (field) =>
    `w-full px-3 py-2 text-sm rounded-lg border ${
      errors[field]
        ? 'border-red-500 dark:border-red-400'
        : 'border-gray-300 dark:border-gray-600'
    } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500`;

  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-8 pb-8 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={closeIntakeModal}
      />
      <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 animate-slide-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            New Vehicle Intake
          </h2>
          <button
            onClick={closeIntakeModal}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Walk-in vs Scheduled Toggle */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 mr-2">Intake Type:</span>
            <button
              type="button"
              onClick={() => {
                setForm((f) => ({
                  ...f,
                  intakeType: 'walk-in',
                  appointmentDate: '',
                  preferredTime: '',
                }));
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                form.intakeType === 'walk-in'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              <Footprints className="w-4 h-4" />
              Walk-in
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, intakeType: 'scheduled' }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                form.intakeType === 'scheduled'
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              <CalendarClock className="w-4 h-4" />
              Scheduled
            </button>
            {form.intakeType === 'walk-in' && (
              <span className="ml-auto text-xs text-blue-600 dark:text-blue-400 font-medium">
                Date set to today &middot; FIFO queue
              </span>
            )}
          </div>

          {/* Customer Info */}
          <fieldset>
            <legend className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 uppercase tracking-wide">
              Customer Information
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.customerName}
                  onChange={set2('customerName')}
                  className={inputCls('customerName')}
                />
                {errors.customerName && (
                  <p className="text-red-500 text-xs mt-1">{errors.customerName}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.phoneNumber}
                  onChange={set2('phoneNumber')}
                  placeholder="+63..."
                  className={inputCls('phoneNumber')}
                />
                {errors.phoneNumber && (
                  <p className="text-red-500 text-xs mt-1">{errors.phoneNumber}</p>
                )}
              </div>
            </div>
          </fieldset>

          {/* Vehicle Info */}
          <fieldset>
            <legend className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 uppercase tracking-wide">
              Vehicle Information
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Year — Dropdown */}
              <div>
                <label className={labelCls}>
                  Year <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.year}
                  onChange={set2('year')}
                  className={inputCls('year')}
                >
                  <option value="">Select year...</option>
                  {VEHICLE_YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                {errors.year && (
                  <p className="text-red-500 text-xs mt-1">{errors.year}</p>
                )}
              </div>

              {/* Make — Combo-box */}
              <div className="relative">
                <label className={labelCls}>
                  Make <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    ref={makeInputRef}
                    type="text"
                    value={form.make}
                    onChange={handleMakeInputChange}
                    onFocus={() => setMakeDropdownOpen(true)}
                    placeholder="Select or type..."
                    className={inputCls('make')}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setMakeDropdownOpen(!makeDropdownOpen)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${makeDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                {makeDropdownOpen && (
                  <div
                    ref={makeDropdownRef}
                    className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg"
                  >
                    {filteredMakes.length > 0 ? (
                      filteredMakes.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleMakeSelect(m)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors ${
                            form.make === m
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium'
                              : 'text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          {m}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
                        No matches — custom value will be used
                      </div>
                    )}
                  </div>
                )}
                {errors.make && (
                  <p className="text-red-500 text-xs mt-1">{errors.make}</p>
                )}
              </div>

              {/* Model */}
              <div>
                <label className={labelCls}>
                  Model <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.model}
                  onChange={set2('model')}
                  placeholder="Vios"
                  className={inputCls('model')}
                />
                {errors.model && (
                  <p className="text-red-500 text-xs mt-1">{errors.model}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <label className={labelCls}>VIN</label>
                <input
                  type="text"
                  value={form.vin}
                  onChange={set2('vin')}
                  className={inputCls('vin')}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Plate Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.plateNumber}
                  onChange={set2('plateNumber')}
                  placeholder="ABC 1234"
                  className={inputCls('plateNumber')}
                />
                {errors.plateNumber && (
                  <p className="text-red-500 text-xs mt-1">{errors.plateNumber}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>
                  Odometer Reading <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.odometerReading}
                  onChange={(e) => {
                    // Allow only digits and commas for readability
                    const val = e.target.value.replace(/[^0-9,]/g, '');
                    setForm((f) => ({ ...f, odometerReading: val }));
                    if (errors.odometerReading) setErrors((er) => ({ ...er, odometerReading: null }));
                  }}
                  placeholder="e.g. 45,230"
                  className={inputCls('odometerReading')}
                />
                {errors.odometerReading && (
                  <p className="text-red-500 text-xs mt-1">{errors.odometerReading}</p>
                )}
              </div>
            </div>
          </fieldset>

          {/* Visit Details — Service Checklist (popup trigger) */}
          <fieldset>
            <legend className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 uppercase tracking-wide">
              Reason for Visit <span className="text-red-500">*</span>
            </legend>
            {errors.reasonForVisit && (
              <p className="text-red-500 text-xs mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />{errors.reasonForVisit}
              </p>
            )}
            <button
              type="button"
              onClick={() => setServiceModalOpen(true)}
              className={`w-full px-4 py-3 rounded-lg border-2 border-dashed text-sm font-medium transition-all flex items-center gap-3 ${
                form.reasonForVisit.length > 0
                  ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/50'
                  : errors.reasonForVisit
                  ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100'
                  : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <ClipboardList className="w-5 h-5 shrink-0" />
              {form.reasonForVisit.length > 0 ? (
                <span>{form.reasonForVisit.length} service{form.reasonForVisit.length !== 1 ? 's' : ''} selected — Click to edit</span>
              ) : (
                <span>Click to Select Services</span>
              )}
            </button>
            {form.reasonForVisit.length > 0 && (
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
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </fieldset>

          {/* Assignment */}
          <fieldset>
            <legend className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 uppercase tracking-wide">
              Assignment
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>
                  Front Desk Lead <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.frontDeskLead}
                  onChange={set2('frontDeskLead')}
                  className={inputCls('frontDeskLead')}
                >
                  <option value="">Select...</option>
                  {frontDesk.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {errors.frontDeskLead && (
                  <p className="text-red-500 text-xs mt-1">{errors.frontDeskLead}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Lead Mechanic</label>
                <select
                  value={form.assignedMechanic}
                  onChange={handleLeadMechanicChange}
                  className={inputCls('assignedMechanic')}
                >
                  <option value="">Assign later...</option>
                  {mechanics.map((m) => (
                    <option key={m.id} value={m.name}>
                      {getMechanicDisplay(m)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>
                  Assistant Mechanic
                  <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">(Optional)</span>
                </label>
                <select
                  value={form.assistantMechanic}
                  onChange={set2('assistantMechanic')}
                  className={inputCls('assistantMechanic')}
                  disabled={!form.assignedMechanic}
                >
                  <option value="">None</option>
                  {assistantOptions.map((m) => (
                    <option key={m.id} value={m.name}>
                      {getMechanicDisplay(m)}
                    </option>
                  ))}
                </select>
                {!form.assignedMechanic && (
                  <p className="text-gray-400 text-[10px] mt-1">Select lead first</p>
                )}
              </div>
            </div>
          </fieldset>

          {/* Scheduling */}
          <fieldset>
            <legend className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 uppercase tracking-wide">
              Scheduling
              {form.intakeType === 'walk-in' && (
                <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500 normal-case">(Walk-in — scheduling disabled)</span>
              )}
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={form.intakeType === 'walk-in' ? 'opacity-50 pointer-events-none' : ''}>
                <label className={labelCls}>Appointment Date</label>
                <input
                  type="date"
                  value={form.appointmentDate}
                  onChange={set2('appointmentDate')}
                  disabled={form.intakeType === 'walk-in'}
                  className={inputCls('appointmentDate')}
                />
              </div>
              <div className={form.intakeType === 'walk-in' ? 'opacity-50 pointer-events-none' : ''}>
                <label className={labelCls}>Preferred Time</label>
                <select
                  value={form.preferredTime}
                  onChange={set2('preferredTime')}
                  disabled={form.intakeType === 'walk-in'}
                  className={inputCls('preferredTime')}
                >
                  <option value="">Select time...</option>
                  {timeSlots.map((slot) => (
                    <option
                      key={slot.val}
                      value={slot.val}
                      disabled={slot.isFull || slot.isPast}
                    >
                      {slot.label}{form.appointmentDate ? ` (${slot.count}/${slotCapacity})` : ''}{slot.isPast ? ' — PASSED' : slot.isFull ? ' — FULL' : ''}
                    </option>
                  ))}
                </select>
                {errors.preferredTime && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />{errors.preferredTime}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className={labelCls}>Est. Man-Hours</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={form.estimatedManHours}
                  onChange={set2('estimatedManHours')}
                  placeholder="e.g. 2.5"
                  className={inputCls('estimatedManHours')}
                />
              </div>
              <div>
                <label className={labelCls}>Est. Completion Time</label>
                <input
                  type="time"
                  value={form.estimatedCompletion}
                  onChange={set2('estimatedCompletion')}
                  className={inputCls('estimatedCompletion')}
                />
              </div>
            </div>
          </fieldset>

          {/* Mechanic bandwidth warnings — show for BOTH lead and assistant */}
          {form.assignedMechanic && form.appointmentDate && (
            <MechanicBandwidthWarning
              mechanicName={form.assignedMechanic}
              appointmentDate={format(new Date(form.appointmentDate + 'T00:00:00'), 'MM/dd/yyyy')}
              estimatedManHours={form.estimatedManHours}
              label="Lead"
            />
          )}
          {form.assistantMechanic && form.appointmentDate && (
            <MechanicBandwidthWarning
              mechanicName={form.assistantMechanic}
              appointmentDate={format(new Date(form.appointmentDate + 'T00:00:00'), 'MM/dd/yyyy')}
              estimatedManHours={form.estimatedManHours}
              label="Assistant"
            />
          )}

          {/* Notes */}
          <div>
            <label className={labelCls}>Internal Notes</label>
            <textarea
              value={form.internalNotes}
              onChange={set2('internalNotes')}
              rows={2}
              className={inputCls('internalNotes')}
              placeholder="Optional internal notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setForm(initialForm);
                setErrors({});
                closeIntakeModal();
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Job
            </button>
          </div>
        </form>
      </div>

      {/* ── Success Confirmation Overlay ─────────────────────────────── */}
      {successData && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm mx-4 p-8 text-center animate-slide-in">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Intake Created!</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">The job has been added to the waitlist.</p>

            {successData.queueNumber && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-700 mb-4">
                <Hash className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-lg font-bold font-mono text-blue-700 dark:text-blue-300 tracking-wide">
                  {successData.queueNumber}
                </span>
              </div>
            )}

            <div className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300 mb-6">
              <p className="font-semibold">{successData.vehicle}</p>
              {successData.plateNumber && (
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{successData.plateNumber}</p>
              )}
              <p>{successData.customerName}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {successData.services} service{successData.services !== 1 ? 's' : ''} selected
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSuccessData(null);
                  closeIntakeModal();
                }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSuccessData(null);
                }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Another
              </button>
            </div>
          </div>
        </div>
      )}

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
                  {form.reasonForVisit.length} service{form.reasonForVisit.length !== 1 ? 's' : ''} selected
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
              {/* ── CHECK-UP ONLY — prominent quick-select ── */}
              {(() => {
                const checkUpLabel = 'Check-Up Only';
                const isCheckUp = form.reasonForVisit.includes(checkUpLabel);
                return (
                  <button
                    type="button"
                    onClick={() => {
                      setForm((f) => {
                        const current = new Set(f.reasonForVisit);
                        if (current.has(checkUpLabel)) {
                          current.delete(checkUpLabel);
                        } else {
                          current.add(checkUpLabel);
                        }
                        return { ...f, reasonForVisit: [...current] };
                      });
                      if (errors.reasonForVisit) setErrors((er) => ({ ...er, reasonForVisit: null }));
                    }}
                    className={`w-full mb-5 flex items-center gap-3 px-5 py-4 rounded-xl border-2 transition-all text-left ${
                      isCheckUp
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-200 dark:ring-emerald-800'
                        : 'bg-gray-50 dark:bg-gray-800/60 border-gray-300 dark:border-gray-600 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20'
                    }`}
                  >
                    <div className={`p-2.5 rounded-lg shrink-0 ${isCheckUp ? 'bg-emerald-200 dark:bg-emerald-800' : 'bg-gray-200 dark:bg-gray-700'}`}>
                      <Stethoscope className={`w-6 h-6 ${isCheckUp ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500 dark:text-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-base font-bold ${isCheckUp ? 'text-emerald-800 dark:text-emerald-200' : 'text-gray-800 dark:text-gray-200'}`}>
                        CHECK-UP ONLY
                      </p>
                      <p className={`text-xs mt-0.5 ${isCheckUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        General inspection — no specific service needed
                      </p>
                    </div>
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isCheckUp
                        ? 'bg-emerald-500 border-emerald-500 dark:bg-emerald-600 dark:border-emerald-600'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {isCheckUp && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                  </button>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {serviceCategories.map((cat) => (
                  <div key={cat.name} className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide border-b-2 border-gray-200 dark:border-gray-700 pb-1.5">
                      {cat.name}
                    </h4>
                    {cat.items.map((item) => {
                      const isChecked = form.reasonForVisit.includes(item);
                      return (
                        <label
                          key={`svc-${cat.name}-${item}`}
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
                                const current = new Set(f.reasonForVisit);
                                if (current.has(item)) {
                                  current.delete(item);
                                } else {
                                  current.add(item);
                                }
                                return { ...f, reasonForVisit: [...current] };
                              });
                              if (errors.reasonForVisit) setErrors((er) => ({ ...er, reasonForVisit: null }));
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
                {form.reasonForVisit.length > 0 ? (
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
