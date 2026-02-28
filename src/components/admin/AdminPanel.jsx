import { useState } from 'react';
import {
  Shield, ShieldOff, Lock, Wrench, UserCircle, Settings, Plus, Trash2, Pencil,
  Download, Clock, ScrollText, X, Check, ChevronDown, ChevronUp, HardDrive,
} from 'lucide-react';
import { useAdminStore } from '../../stores/adminStore';
import { useJobsStore } from '../../stores/jobsStore';

export default function AdminPanel() {
  const admin = useAdminStore();
  const jobs = useJobsStore((s) => s.jobs);
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState(false);
  const [section, setSection] = useState('personnel'); // personnel | settings | backup | logs

  // Inline editing states
  const [editingMech, setEditingMech] = useState(null); // { id, name, shortName } or null
  const [newMech, setNewMech] = useState({ name: '', shortName: '' });
  const [editingFD, setEditingFD] = useState(null); // { id, name }
  const [newFD, setNewFD] = useState({ name: '' });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // ── Login gate ──────────────────────────────────────────────────────────
  if (!admin.adminMode) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Admin Access Required</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
            Enter the admin password to continue.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const ok = admin.toggleAdminMode(password);
              if (!ok) {
                setPwError(true);
                setTimeout(() => setPwError(false), 2000);
              }
              setPassword('');
            }}
            className="space-y-3"
          >
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password..."
              className={`w-full px-4 py-2.5 text-sm rounded-lg border ${
                pwError
                  ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                  : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900'
              } text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              autoFocus
            />
            {pwError && (
              <p className="text-red-500 text-xs font-medium">Incorrect password. Try again.</p>
            )}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Shield className="w-4 h-4" />
              Unlock Admin Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const handleAddMech = () => {
    if (!newMech.name.trim() || !newMech.shortName.trim()) return;
    admin.addMechanic(newMech.name.trim(), newMech.shortName.trim());
    setNewMech({ name: '', shortName: '' });
  };
  const handleSaveMech = () => {
    if (!editingMech || !editingMech.name.trim() || !editingMech.shortName.trim()) return;
    admin.updateMechanic(editingMech.id, editingMech.name.trim(), editingMech.shortName.trim());
    setEditingMech(null);
  };
  const handleAddFD = () => {
    if (!newFD.name.trim()) return;
    admin.addFrontDesk(newFD.name.trim());
    setNewFD({ name: '' });
  };
  const handleSaveFD = () => {
    if (!editingFD || !editingFD.name.trim()) return;
    admin.updateFrontDesk(editingFD.id, editingFD.name.trim());
    setEditingFD(null);
  };

  const inputCls =
    'w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';

  const SectionButton = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setSection(id)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        section === id
          ? 'bg-blue-600 text-white shadow-md'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Admin header */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/40">
            <Shield className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Admin Panel</h2>
            <p className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Admin Mode Active
            </p>
          </div>
        </div>
        <button
          onClick={() => admin.toggleAdminMode('')}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
        >
          <ShieldOff className="w-4 h-4" />
          Lock Panel
        </button>
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-2">
        <SectionButton id="personnel" label="Personnel" icon={UserCircle} />
        <SectionButton id="settings" label="System Settings" icon={Settings} />
        <SectionButton id="backup" label="Data Backup" icon={HardDrive} />
        <SectionButton id="logs" label="Audit Logs" icon={ScrollText} />
      </div>

      {/* ── PERSONNEL ────────────────────────────────────────────────────── */}
      {section === 'personnel' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Mechanics */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Mechanics ({admin.mechanics.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[400px] overflow-y-auto">
              {admin.mechanics.map((m) =>
                editingMech?.id === m.id ? (
                  <div key={m.id} className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/30">
                    <input value={editingMech.name} onChange={(e) => setEditingMech({ ...editingMech, name: e.target.value })} className={inputCls} placeholder="Full name" />
                    <input value={editingMech.shortName} onChange={(e) => setEditingMech({ ...editingMech, shortName: e.target.value })} className={`${inputCls} w-24`} placeholder="Short" />
                    <button onClick={handleSaveMech} className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditingMech(null)} className="p-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 group">
                    <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{m.name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-900 px-2 py-0.5 rounded">{m.shortName}</span>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                      <button onClick={() => setEditingMech({ ...m })} className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400"><Pencil className="w-3.5 h-3.5" /></button>
                      {confirmDeleteId === m.id ? (
                        <button onClick={() => { admin.removeMechanic(m.id); setConfirmDeleteId(null); }} className="px-2 py-0.5 text-[10px] font-bold text-white bg-red-600 rounded hover:bg-red-700">Confirm</button>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(m.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
            {/* Add new */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <div className="flex items-center gap-2">
                <input value={newMech.name} onChange={(e) => setNewMech({ ...newMech, name: e.target.value })} placeholder="Full name..." className={inputCls} />
                <input value={newMech.shortName} onChange={(e) => setNewMech({ ...newMech, shortName: e.target.value })} placeholder="Short" className={`${inputCls} w-24`} />
                <button onClick={handleAddMech} disabled={!newMech.name.trim() || !newMech.shortName.trim()} className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none transition-colors shrink-0">
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Front Desk */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <UserCircle className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Front Desk Leads ({admin.frontDesk.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[400px] overflow-y-auto">
              {admin.frontDesk.map((f) =>
                editingFD?.id === f.id ? (
                  <div key={f.id} className="flex items-center gap-2 px-4 py-2 bg-violet-50 dark:bg-violet-950/30">
                    <input value={editingFD.name} onChange={(e) => setEditingFD({ ...editingFD, name: e.target.value })} className={inputCls} placeholder="Name" />
                    <button onClick={handleSaveFD} className="p-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditingFD(null)} className="p-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 group">
                    <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{f.name}</span>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                      <button onClick={() => setEditingFD({ ...f })} className="p-1 rounded hover:bg-violet-100 dark:hover:bg-violet-900/40 text-violet-600 dark:text-violet-400"><Pencil className="w-3.5 h-3.5" /></button>
                      {confirmDeleteId === f.id ? (
                        <button onClick={() => { admin.removeFrontDesk(f.id); setConfirmDeleteId(null); }} className="px-2 py-0.5 text-[10px] font-bold text-white bg-red-600 rounded hover:bg-red-700">Confirm</button>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(f.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <div className="flex items-center gap-2">
                <input value={newFD.name} onChange={(e) => setNewFD({ name: e.target.value })} placeholder="Name..." className={inputCls} />
                <button onClick={handleAddFD} disabled={!newFD.name.trim()} className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-40 disabled:pointer-events-none transition-colors shrink-0">
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SYSTEM SETTINGS ──────────────────────────────────────────────── */}
      {section === 'settings' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-6">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-500" />
            System Configuration
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Lifter Bays */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lifter Bays</label>
              <input
                type="number" min="1" max="20"
                value={admin.lifterBayCount}
                onChange={(e) => admin.setLifterBayCount(Math.max(1, parseInt(e.target.value) || 1))}
                className={inputCls}
              />
              <p className="text-[10px] text-gray-400 mt-1">Currently {admin.lifterBayCount} bays</p>
            </div>

            {/* Non-Lifter Bays */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Non-Lifter Bays</label>
              <input
                type="number" min="1" max="30"
                value={admin.nonLifterBayCount}
                onChange={(e) => admin.setNonLifterBayCount(Math.max(1, parseInt(e.target.value) || 1))}
                className={inputCls}
              />
              <p className="text-[10px] text-gray-400 mt-1">Currently {admin.nonLifterBayCount} bays</p>
            </div>

            {/* Max Jobs per Slot */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Jobs per Time Slot</label>
              <input
                type="number" min="1" max="20"
                value={admin.slotCapacity}
                onChange={(e) => admin.setSlotCapacity(Math.max(1, parseInt(e.target.value) || 1))}
                className={inputCls}
              />
              <p className="text-[10px] text-gray-400 mt-1">Calendar booking limit per 30-min slot</p>
            </div>

            {/* Shop Hours Start */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shop Opens</label>
              <input
                type="time"
                value={admin.shopHoursStart}
                onChange={(e) => admin.setShopHours(e.target.value, admin.shopHoursEnd)}
                className={inputCls}
              />
            </div>

            {/* Shop Hours End */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shop Closes</label>
              <input
                type="time"
                value={admin.shopHoursEnd}
                onChange={(e) => admin.setShopHours(admin.shopHoursStart, e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Total Bays: {admin.lifterBayCount + admin.nonLifterBayCount} &nbsp;|&nbsp;
              Shop Hours: {admin.shopHoursStart} &ndash; {admin.shopHoursEnd} &nbsp;|&nbsp;
              Slot Limit: {admin.slotCapacity}
            </p>
          </div>
        </div>
      )}

      {/* ── DATA BACKUP ──────────────────────────────────────────────────── */}
      {section === 'backup' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-6">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-gray-500" />
            Manual Data Backup
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{jobs.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Jobs</p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">{admin.mechanics.length + admin.frontDesk.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Personnel Records</p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{admin.auditLogs.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Audit Log Entries</p>
            </div>
          </div>

          <button
            onClick={() => admin.exportBackup(jobs)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-md"
          >
            <Download className="w-5 h-5" />
            Export Full Backup (JSON)
          </button>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
            Includes all jobs, personnel rosters, system settings, and audit logs.
          </p>
        </div>
      )}

      {/* ── AUDIT LOGS ───────────────────────────────────────────────────── */}
      {section === 'logs' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Audit Logs ({admin.auditLogs.length})
            </h3>
            {admin.auditLogs.length > 0 && (
              <button
                onClick={() => admin.clearAuditLogs()}
                className="ml-auto text-[10px] text-red-500 hover:text-red-600 hover:underline font-medium"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
            {admin.auditLogs.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">No audit log entries yet.</p>
            ) : (
              admin.auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 text-xs">
                  <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                  <span className="text-gray-400 dark:text-gray-500 font-mono whitespace-nowrap shrink-0">{log.timestamp}</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{log.action}</span>
                  {log.detail && (
                    <span className="text-gray-500 dark:text-gray-400 truncate">{log.detail}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
