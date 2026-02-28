import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

// ── Default seed data (matches original rosters.js) ──────────────────────────
const DEFAULT_MECHANICS = [
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

const DEFAULT_FRONT_DESK = [
  { id: 'fd-1', name: 'Abi' },
  { id: 'fd-2', name: 'Kathleen' },
  { id: 'fd-3', name: 'Jelyn' },
  { id: 'fd-4', name: 'Arlene' },
  { id: 'fd-5', name: 'Leslie' },
  { id: 'fd-6', name: 'Ma Jelyn' },
  { id: 'fd-7', name: 'Ronna' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const buildBayArray = (count, type) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${type === 'lifter' ? 'lifter' : 'nonlifter'}-${i + 1}`,
    label: `${type === 'lifter' ? 'Lifter' : 'Non-Lifter'} ${i + 1}`,
    type,
  }));

const ts = () => format(new Date(), 'MM/dd/yyyy hh:mm a');

// ── Store ─────────────────────────────────────────────────────────────────────
export const useAdminStore = create(
  persist(
    (set, get) => ({
      // Personnel
      mechanics: DEFAULT_MECHANICS,
      frontDesk: DEFAULT_FRONT_DESK,

      // Bay configuration
      lifterBayCount: 7,
      nonLifterBayCount: 10,

      // Shop settings
      shopHoursStart: '08:00',
      shopHoursEnd: '17:00',
      slotCapacity: 5,

      // Admin access
      adminMode: false,

      // Audit logs — [{ id, timestamp, action, detail }]
      auditLogs: [],

      // ── Computed getters (call as functions) ────────────────────────────
      getLifterBays: () => buildBayArray(get().lifterBayCount, 'lifter'),
      getNonLifterBays: () => buildBayArray(get().nonLifterBayCount, 'nonlifter'),
      getAllBays: () => [
        ...buildBayArray(get().lifterBayCount, 'lifter'),
        ...buildBayArray(get().nonLifterBayCount, 'nonlifter'),
      ],

      // ── Admin mode ──────────────────────────────────────────────────────
      toggleAdminMode: (password) => {
        const s = get();
        if (s.adminMode) {
          set({ adminMode: false });
          return true;
        }
        // Mock password check
        if (password === '060801') {
          set({ adminMode: true });
          get().addAuditLog('Admin Mode enabled');
          return true;
        }
        return false;
      },

      // ── Audit log helper ────────────────────────────────────────────────
      addAuditLog: (action, detail = '') =>
        set((s) => ({
          auditLogs: [
            { id: uuidv4(), timestamp: ts(), action, detail },
            ...s.auditLogs,
          ].slice(0, 200), // keep last 200 entries
        })),

      // ── Mechanic CRUD ───────────────────────────────────────────────────
      addMechanic: (name, shortName) => {
        const id = `mech-${uuidv4().slice(0, 8)}`;
        set((s) => ({
          mechanics: [...s.mechanics, { id, name, shortName }],
        }));
        get().addAuditLog('Added Mechanic', `${name} (${shortName})`);
      },
      updateMechanic: (id, name, shortName) => {
        set((s) => ({
          mechanics: s.mechanics.map((m) =>
            m.id === id ? { ...m, name, shortName } : m
          ),
        }));
        get().addAuditLog('Updated Mechanic', `${name} (${shortName})`);
      },
      removeMechanic: (id) => {
        const mech = get().mechanics.find((m) => m.id === id);
        set((s) => ({
          mechanics: s.mechanics.filter((m) => m.id !== id),
        }));
        if (mech) get().addAuditLog('Removed Mechanic', mech.name);
      },

      // ── Front Desk CRUD ─────────────────────────────────────────────────
      addFrontDesk: (name) => {
        const id = `fd-${uuidv4().slice(0, 8)}`;
        set((s) => ({
          frontDesk: [...s.frontDesk, { id, name }],
        }));
        get().addAuditLog('Added Front Desk', name);
      },
      updateFrontDesk: (id, name) => {
        set((s) => ({
          frontDesk: s.frontDesk.map((f) =>
            f.id === id ? { ...f, name } : f
          ),
        }));
        get().addAuditLog('Updated Front Desk', name);
      },
      removeFrontDesk: (id) => {
        const fd = get().frontDesk.find((f) => f.id === id);
        set((s) => ({
          frontDesk: s.frontDesk.filter((f) => f.id !== id),
        }));
        if (fd) get().addAuditLog('Removed Front Desk', fd.name);
      },

      // ── System settings ─────────────────────────────────────────────────
      setLifterBayCount: (n) => {
        set({ lifterBayCount: n });
        get().addAuditLog('Updated Lifter Bay Count', `${n}`);
      },
      setNonLifterBayCount: (n) => {
        set({ nonLifterBayCount: n });
        get().addAuditLog('Updated Non-Lifter Bay Count', `${n}`);
      },
      setShopHours: (start, end) => {
        set({ shopHoursStart: start, shopHoursEnd: end });
        get().addAuditLog('Updated Shop Hours', `${start} — ${end}`);
      },
      setSlotCapacity: (n) => {
        set({ slotCapacity: n });
        get().addAuditLog('Updated Slot Capacity', `${n}`);
      },

      // ── Data backup ─────────────────────────────────────────────────────
      exportBackup: (jobs) => {
        const data = {
          exportedAt: new Date().toISOString(),
          admin: {
            mechanics: get().mechanics,
            frontDesk: get().frontDesk,
            lifterBayCount: get().lifterBayCount,
            nonLifterBayCount: get().nonLifterBayCount,
            shopHoursStart: get().shopHoursStart,
            shopHoursEnd: get().shopHoursEnd,
            slotCapacity: get().slotCapacity,
          },
          jobs,
          auditLogs: get().auditLogs,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `CBROS_Backup_${format(new Date(), 'yyyy-MM-dd_HHmm')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        get().addAuditLog('Exported Data Backup');
      },

      clearAuditLogs: () => {
        set({ auditLogs: [] });
      },
    }),
    {
      name: 'cbros-admin',
    }
  )
);
