import { LayoutGrid, CalendarDays, BarChart3, ShieldAlert } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

const tabs = [
  { id: 'floor', label: 'Live Floor', icon: LayoutGrid },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'reports', label: 'Registry / Reports', icon: BarChart3 },
  { id: 'admin', label: 'Admin', icon: ShieldAlert, accent: true },
];

export default function TabBar() {
  const { activeTab, setActiveTab } = useUIStore();

  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-[1600px] mx-auto px-4">
        <nav className="flex gap-1">
          {tabs.map(({ id, label, icon: Icon, accent }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? accent
                    ? 'border-amber-600 text-amber-600 dark:text-amber-400 dark:border-amber-400'
                    : 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : accent
                  ? 'border-transparent text-amber-500/70 dark:text-amber-500/50 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-300 dark:hover:border-amber-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
