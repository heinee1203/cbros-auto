import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { DEFAULT_SERVICE_CATEGORIES } from '../data/rosters';
import {
  firestoreUpdateMechanics,
  firestoreUpdateFrontDesk,
  firestoreUpdateSettings,
  firestoreUpdateCategories,
  firestoreUpdateAuditLogs,
} from '../services/firestorePersonnel';

// ── Default seed data (matches original rosters.js) ──────────────────────────
export const DEFAULT_MECHANICS = [
  { id: 'mech-1', name: 'Chief Mechanic Allan', shortName: 'Allan', nickname: '' },
  { id: 'mech-2', name: 'Honnel "Inggo"', shortName: 'Inggo', nickname: '' },
  { id: 'mech-3', name: 'Rosalino "Lino"', shortName: 'Lino', nickname: '' },
  { id: 'mech-4', name: 'Anthony "Toni"', shortName: 'Toni', nickname: '' },
  { id: 'mech-5', name: 'Jurell', shortName: 'Jurell', nickname: '' },
  { id: 'mech-6', name: 'Samuel "Sam"', shortName: 'Sam', nickname: '' },
  { id: 'mech-7', name: 'Arnold "Nold"', shortName: 'Nold', nickname: '' },
  { id: 'mech-8', name: 'Joy', shortName: 'Joy', nickname: '' },
  { id: 'mech-9', name: 'Kevin', shortName: 'Kevin', nickname: '' },
  { id: 'mech-10', name: 'Ronnel "Buban"', shortName: 'Buban', nickname: '' },
  { id: 'mech-11', name: 'Joseph', shortName: 'Joseph', nickname: '' },
  { id: 'mech-12', name: 'Roi', shortName: 'Roi', nickname: '' },
];

export const DEFAULT_FRONT_DESK = [
  { id: 'fd-1', name: 'Abi' },
  { id: 'fd-2', name: 'Kathleen' },
  { id: 'fd-3', name: 'Jelyn' },
  { id: 'fd-4', name: 'Arlene' },
  { id: 'fd-5', name: 'Leslie' },
  { id: 'fd-6', name: 'Ma Jelyn' },
  { id: 'fd-7', name: 'Ronna' },
];

export const DEFAULT_SETTINGS = {
  lifterBayCount: 7,
  nonLifterBayCount: 10,
  shopHoursStart: '08:00',
  shopHoursEnd: '17:00',
  slotCapacity: 5,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const buildBayArray = (count, type) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${type === 'lifter' ? 'lifter' : 'nonlifter'}-${i + 1}`,
    label: `${type === 'lifter' ? 'Lifter' : 'Non-Lifter'} ${i + 1}`,
    type,
  }));

const ts = () => format(new Date(), 'MM/dd/yyyy hh:mm a');

// ── Utility: get display name for a mechanic ─────────────────────────────────
export const getMechanicDisplay = (mechanicNameOrObj, mechanicsArray) => {
  if (!mechanicNameOrObj) return '';
  if (typeof mechanicNameOrObj === 'object' && mechanicNameOrObj !== null) {
    const m = mechanicNameOrObj;
    if (m.nickname) return m.nickname;
    return m.shortName || m.name?.split(' ')[0] || m.name || '';
  }
  if (typeof mechanicNameOrObj === 'string' && Array.isArray(mechanicsArray)) {
    const m = mechanicsArray.find((mech) => mech.name === mechanicNameOrObj);
    if (m) {
      if (m.nickname) return m.nickname;
      return m.shortName || m.name.split(' ')[0];
    }
    return mechanicNameOrObj;
  }
  return String(mechanicNameOrObj);
};

// ── Firestore write helper: write audit logs then sync ──────────────────────
const writeAuditLogs = async (logs) => {
  try {
    await firestoreUpdateAuditLogs(logs);
  } catch (err) {
    console.error('Failed to update audit logs in Firestore:', err);
  }
};

// ── Store ─────────────────────────────────────────────────────────────────────
export const useAdminStore = create((set, get) => ({
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

  // Dynamic service categories
  serviceCategories: DEFAULT_SERVICE_CATEGORIES,

  // Admin access (per-device, not synced)
  adminMode: false,

  // Audit logs — [{ id, timestamp, action, detail }]
  auditLogs: [],

  // ── Firestore-fed setter (called by FirebaseSyncProvider) ──────────────
  _setFromFirestore: (data) => {
    const updates = {};
    if (data.mechanics?.list) updates.mechanics = data.mechanics.list;
    if (data.frontDesk?.list) updates.frontDesk = data.frontDesk.list;
    if (data.serviceCategories?.categories) updates.serviceCategories = data.serviceCategories.categories;
    if (data.auditLogs?.logs) updates.auditLogs = data.auditLogs.logs;
    if (data.settings) {
      if (data.settings.lifterBayCount !== undefined) updates.lifterBayCount = data.settings.lifterBayCount;
      if (data.settings.nonLifterBayCount !== undefined) updates.nonLifterBayCount = data.settings.nonLifterBayCount;
      if (data.settings.shopHoursStart !== undefined) updates.shopHoursStart = data.settings.shopHoursStart;
      if (data.settings.shopHoursEnd !== undefined) updates.shopHoursEnd = data.settings.shopHoursEnd;
      if (data.settings.slotCapacity !== undefined) updates.slotCapacity = data.settings.slotCapacity;
    }
    if (Object.keys(updates).length > 0) set(updates);
  },

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
    if (password === '060801') {
      set({ adminMode: true });
      get().addAuditLog('Admin Mode enabled');
      return true;
    }
    return false;
  },

  // ── Audit log helper ────────────────────────────────────────────────
  addAuditLog: (action, detail = '') => {
    const newLogs = [
      { id: uuidv4(), timestamp: ts(), action, detail },
      ...get().auditLogs,
    ].slice(0, 200);
    set({ auditLogs: newLogs });
    writeAuditLogs(newLogs);
  },

  // ── Mechanic CRUD ───────────────────────────────────────────────────
  addMechanic: (name, shortName, nickname = '') => {
    const id = `mech-${uuidv4().slice(0, 8)}`;
    const newMechanics = [...get().mechanics, { id, name, shortName, nickname: nickname || '' }];
    set({ mechanics: newMechanics });
    firestoreUpdateMechanics(newMechanics).catch((err) => console.error(err));
    get().addAuditLog('Added Mechanic', `${name} (${shortName}${nickname ? `, nick: ${nickname}` : ''})`);
  },
  updateMechanic: (id, name, shortName, nickname = '') => {
    const newMechanics = get().mechanics.map((m) =>
      m.id === id ? { ...m, name, shortName, nickname: nickname || '' } : m
    );
    set({ mechanics: newMechanics });
    firestoreUpdateMechanics(newMechanics).catch((err) => console.error(err));
    get().addAuditLog('Updated Mechanic', `${name} (${shortName}${nickname ? `, nick: ${nickname}` : ''})`);
  },
  removeMechanic: (id) => {
    const mech = get().mechanics.find((m) => m.id === id);
    const newMechanics = get().mechanics.filter((m) => m.id !== id);
    set({ mechanics: newMechanics });
    firestoreUpdateMechanics(newMechanics).catch((err) => console.error(err));
    if (mech) get().addAuditLog('Removed Mechanic', mech.name);
  },

  // ── Front Desk CRUD ─────────────────────────────────────────────────
  addFrontDesk: (name) => {
    const id = `fd-${uuidv4().slice(0, 8)}`;
    const newFD = [...get().frontDesk, { id, name }];
    set({ frontDesk: newFD });
    firestoreUpdateFrontDesk(newFD).catch((err) => console.error(err));
    get().addAuditLog('Added Front Desk', name);
  },
  updateFrontDesk: (id, name) => {
    const newFD = get().frontDesk.map((f) => (f.id === id ? { ...f, name } : f));
    set({ frontDesk: newFD });
    firestoreUpdateFrontDesk(newFD).catch((err) => console.error(err));
    get().addAuditLog('Updated Front Desk', name);
  },
  removeFrontDesk: (id) => {
    const fd = get().frontDesk.find((f) => f.id === id);
    const newFD = get().frontDesk.filter((f) => f.id !== id);
    set({ frontDesk: newFD });
    firestoreUpdateFrontDesk(newFD).catch((err) => console.error(err));
    if (fd) get().addAuditLog('Removed Front Desk', fd.name);
  },

  // ── Service Category CRUD ──────────────────────────────────────────
  addCategory: (name) => {
    const newCats = [...get().serviceCategories, { name, items: [] }];
    set({ serviceCategories: newCats });
    firestoreUpdateCategories(newCats).catch((err) => console.error(err));
    get().addAuditLog('Added Service Category', name);
  },
  updateCategory: (oldName, newName) => {
    const newCats = get().serviceCategories.map((c) =>
      c.name === oldName ? { ...c, name: newName } : c
    );
    set({ serviceCategories: newCats });
    firestoreUpdateCategories(newCats).catch((err) => console.error(err));
    get().addAuditLog('Renamed Service Category', `${oldName} → ${newName}`);
  },
  removeCategory: (name) => {
    const newCats = get().serviceCategories.filter((c) => c.name !== name);
    set({ serviceCategories: newCats });
    firestoreUpdateCategories(newCats).catch((err) => console.error(err));
    get().addAuditLog('Removed Service Category', name);
  },
  addServiceItem: (categoryName, itemName) => {
    const newCats = get().serviceCategories.map((c) =>
      c.name === categoryName
        ? { ...c, items: [...c.items, itemName] }
        : c
    );
    set({ serviceCategories: newCats });
    firestoreUpdateCategories(newCats).catch((err) => console.error(err));
    get().addAuditLog('Added Service', `${itemName} (in ${categoryName})`);
  },
  updateServiceItem: (categoryName, oldItem, newItem) => {
    const newCats = get().serviceCategories.map((c) =>
      c.name === categoryName
        ? { ...c, items: c.items.map((i) => (i === oldItem ? newItem : i)) }
        : c
    );
    set({ serviceCategories: newCats });
    firestoreUpdateCategories(newCats).catch((err) => console.error(err));
    get().addAuditLog('Updated Service', `${oldItem} → ${newItem} (in ${categoryName})`);
  },
  removeServiceItem: (categoryName, itemName) => {
    const newCats = get().serviceCategories.map((c) =>
      c.name === categoryName
        ? { ...c, items: c.items.filter((i) => i !== itemName) }
        : c
    );
    set({ serviceCategories: newCats });
    firestoreUpdateCategories(newCats).catch((err) => console.error(err));
    get().addAuditLog('Removed Service', `${itemName} (from ${categoryName})`);
  },

  // ── System settings ─────────────────────────────────────────────────
  setLifterBayCount: (n) => {
    set({ lifterBayCount: n });
    const s = get();
    firestoreUpdateSettings({
      lifterBayCount: n, nonLifterBayCount: s.nonLifterBayCount,
      shopHoursStart: s.shopHoursStart, shopHoursEnd: s.shopHoursEnd, slotCapacity: s.slotCapacity,
    }).catch((err) => console.error(err));
    get().addAuditLog('Updated Lifter Bay Count', `${n}`);
  },
  setNonLifterBayCount: (n) => {
    set({ nonLifterBayCount: n });
    const s = get();
    firestoreUpdateSettings({
      lifterBayCount: s.lifterBayCount, nonLifterBayCount: n,
      shopHoursStart: s.shopHoursStart, shopHoursEnd: s.shopHoursEnd, slotCapacity: s.slotCapacity,
    }).catch((err) => console.error(err));
    get().addAuditLog('Updated Non-Lifter Bay Count', `${n}`);
  },
  setShopHours: (start, end) => {
    set({ shopHoursStart: start, shopHoursEnd: end });
    const s = get();
    firestoreUpdateSettings({
      lifterBayCount: s.lifterBayCount, nonLifterBayCount: s.nonLifterBayCount,
      shopHoursStart: start, shopHoursEnd: end, slotCapacity: s.slotCapacity,
    }).catch((err) => console.error(err));
    get().addAuditLog('Updated Shop Hours', `${start} — ${end}`);
  },
  setSlotCapacity: (n) => {
    set({ slotCapacity: n });
    const s = get();
    firestoreUpdateSettings({
      lifterBayCount: s.lifterBayCount, nonLifterBayCount: s.nonLifterBayCount,
      shopHoursStart: s.shopHoursStart, shopHoursEnd: s.shopHoursEnd, slotCapacity: n,
    }).catch((err) => console.error(err));
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
        serviceCategories: get().serviceCategories,
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
    writeAuditLogs([]);
  },
}));
