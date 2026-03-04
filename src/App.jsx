import { useEffect, useRef } from 'react';
import { useAuthStore } from './stores/authStore';
import { useUIStore } from './stores/uiStore';
import LoginPage from './components/auth/LoginPage';
import LockScreen from './components/auth/LockScreen';
import FirebaseSyncProvider from './providers/FirebaseSyncProvider';
import Header from './components/layout/Header';
import TabBar from './components/layout/TabBar';
import IntakeModal from './components/jobs/IntakeModal';
import CancelIntakeModal from './components/jobs/CancelIntakeModal';
import JobDetailDrawer from './components/jobs/JobDetailDrawer';
import KanbanBoard from './components/kanban/KanbanBoard';
import CalendarView from './components/calendar/CalendarView';
import MechanicLoadTable from './components/reports/MechanicLoadTable';
import EODReportModal from './components/reports/EODReportModal';
import AdminPanel from './components/admin/AdminPanel';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

function MainApp() {
  const activeTab = useUIStore((s) => s.activeTab);
  const editingJobId = useUIStore((s) => s.editingJobId);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Header />
      <TabBar />

      <main className="max-w-[1600px] mx-auto px-4 py-6">
        {activeTab === 'floor' && <KanbanBoard />}
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'reports' && <MechanicLoadTable />}
        {activeTab === 'admin' && <AdminPanel />}
      </main>

      <IntakeModal />
      <CancelIntakeModal />
      <EODReportModal />
      {editingJobId && <JobDetailDrawer />}
    </div>
  );
}

function App() {
  const initRef = useRef(false);
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const isLocked = useAuthStore((s) => s.isLocked);
  const lock = useAuthStore((s) => s.lock);

  // Initialize Firebase Auth listener once
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    useAuthStore.getState()._initAuth();
  }, []);

  // Idle timer — lock screen after 15 minutes of inactivity
  useEffect(() => {
    if (!user || isLocked) return;

    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => lock(), IDLE_TIMEOUT_MS);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [user, isLocked, lock]);

  // Loading — checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-blue-200 dark:border-blue-800" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 dark:border-t-blue-400 animate-spin" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">CBROS Auto</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated — show login page
  if (!user) {
    return <LoginPage />;
  }

  // Authenticated — show main app with optional lock screen overlay
  return (
    <FirebaseSyncProvider>
      <MainApp />
      {isLocked && <LockScreen />}
    </FirebaseSyncProvider>
  );
}

export default App;
