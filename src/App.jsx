import { useUIStore } from './stores/uiStore';
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

function App() {
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

export default App;
