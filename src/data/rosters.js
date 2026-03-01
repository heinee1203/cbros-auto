export const MECHANICS = [
  { id: 'mech-1', name: 'Chief Mechanic Allan', shortName: 'Allan' },
  { id: 'mech-2', name: 'Honnel "Inggo"', shortName: 'Inggo' },
  { id: 'mech-3', name: 'Rosalino "Lino"', shortName: 'Lino' },
  { id: 'mech-4', name: 'Anthony "Toni"', shortName: 'Toni' },
  { id: 'mech-5', name: 'Jurell', shortName: 'Jurell' },
  { id: 'mech-6', name: 'Samuel "Sam"', shortName: 'Sam' },
  { id: 'mech-7', name: 'Arnold "Nold"', shortName: 'Nold' },
  { id: 'mech-8', name: 'Joy', shortName: 'Joy' },
  { id: 'mech-9', name: 'Kevin', shortName: 'Kevin' },
  { id: 'mech-10', name: 'Ronnel "Buban"', shortName: 'Buban' },
  { id: 'mech-11', name: 'Joseph', shortName: 'Joseph' },
  { id: 'mech-12', name: 'Roi', shortName: 'Roi' },
];

export const FRONT_DESK = [
  { id: 'fd-1', name: 'Abi' },
  { id: 'fd-2', name: 'Kathleen' },
  { id: 'fd-3', name: 'Jelyn' },
  { id: 'fd-4', name: 'Arlene' },
  { id: 'fd-5', name: 'Leslie' },
  { id: 'fd-6', name: 'Ma Jelyn' },
  { id: 'fd-7', name: 'Ronna' },
];

export const JOB_STATUSES = {
  WAITLIST: 'WAITLIST',
  IN_SERVICE: 'IN_SERVICE',
  AWAITING_PARTS: 'AWAITING_PARTS',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  DONE: 'DONE',
};

export const STATUS_LABELS = {
  WAITLIST: 'Waitlist',
  IN_SERVICE: 'In-Service',
  AWAITING_PARTS: 'Awaiting Parts',
  READY_FOR_PICKUP: 'Ready for Pickup',
  DONE: 'Done',
};

export const STATUS_ORDER = [
  JOB_STATUSES.WAITLIST,
  JOB_STATUSES.IN_SERVICE,
  JOB_STATUSES.AWAITING_PARTS,
  JOB_STATUSES.READY_FOR_PICKUP,
  JOB_STATUSES.DONE,
];

// Bay definitions
export const LIFTER_BAYS = Array.from({ length: 7 }, (_, i) => ({
  id: `lifter-${i + 1}`,
  label: `Lifter ${i + 1}`,
  type: 'lifter',
}));

export const NON_LIFTER_BAYS = Array.from({ length: 10 }, (_, i) => ({
  id: `nonlifter-${i + 1}`,
  label: `Non-Lifter ${i + 1}`,
  type: 'nonlifter',
}));

export const ALL_BAYS = [...LIFTER_BAYS, ...NON_LIFTER_BAYS];

export const SLOT_CAPACITY = 5;

// Service categories for "Reason for Visit" checklist (default seed — managed dynamically via Admin)
export const DEFAULT_SERVICE_CATEGORIES = [
  {
    name: 'Oil & Fluids',
    items: ['Change Oil & Filter', 'Coolant Flush', 'Transmission Fluid Service', 'Differential Fluid Change'],
  },
  {
    name: 'Brakes & Tires',
    items: ['Brake Cleaning & Adjustment', 'Replace Brake Pads/Shoes', 'Brake Rotor Resurfacing/Replacement', 'Tire Rotation', 'Wheel Alignment', 'Wheel Balancing'],
  },
  {
    name: 'Suspension & Steering',
    items: ['Replace Steering Rack', 'Replace Shock Absorbers/Struts', 'Replace Control Arms', 'Replace Ball Joints', 'Bushing Replacement', 'Replace Tie Rod End & Rack Ends', 'Wheel Bearing Replacement'],
  },
  {
    name: 'Transmission & Clutch',
    items: ['Clutch Repair/Replacement', 'Transmission Fluid Service'],
  },
  {
    name: 'Filters & Ignition',
    items: ['Replace Engine Air Filter', 'Replace Cabin Air Filter', 'Replace Spark Plugs', 'Fuel Filter Replacement', 'Throttle Body Cleaning'],
  },
  {
    name: 'Electrical & Belts',
    items: ['Battery Replacement', 'Alternator Replacement', 'Starter Motor Replacement', 'Replace Serpentine Belt', 'Replace Timing Belt'],
  },
  {
    name: 'Inspections & General',
    items: ['Engine Diagnostic/Scanning', 'Underbody Inspection'],
  },
];

// Pre-loaded vehicle makes for combo-box (alphabetically sorted)
export const VEHICLE_MAKES = [
  'BYD', 'Chevrolet', 'Ford', 'Foton', 'Geely', 'Honda', 'Hyundai',
  'Isuzu', 'Kia', 'Lexus', 'Mazda', 'MG', 'Mitsubishi', 'Nissan',
  'Subaru', 'Suzuki', 'Toyota',
];

// Year range for dropdown (current year down to 1990)
export const VEHICLE_YEARS = Array.from(
  { length: new Date().getFullYear() - 1989 },
  (_, i) => String(new Date().getFullYear() - i)
);
