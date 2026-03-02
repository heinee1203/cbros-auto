import { Sun, Moon, Plus, Search, Wrench, FileText, UserCircle, Wrench as WrenchIcon } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAdminStore, getMechanicDisplay } from '../../stores/adminStore';

export default function Header() {
  const { theme, toggleTheme, openIntakeModal, openEodModal, searchQuery, setSearchQuery, filterFrontDesk, setFilterFrontDesk, filterMechanic, setFilterMechanic } =
    useUIStore();
  const mechanics = useAdminStore((s) => s.mechanics);
  const frontDesk = useAdminStore((s) => s.frontDesk);

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2.5 mr-auto">
          <div className="p-1.5 bg-blue-600 dark:bg-blue-500 rounded-lg">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white whitespace-nowrap tracking-tight">
            CBROS Auto Service Division
          </h1>
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search plate, VIN, name, model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filter by Front Desk Lead */}
        <select
          value={filterFrontDesk}
          onChange={(e) => setFilterFrontDesk(e.target.value)}
          className={`text-sm pl-2 pr-7 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem_1rem] ${
            filterFrontDesk
              ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
              : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236b7280'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z'/%3E%3C/svg%3E")` }}
          title="Filter by Front Desk Lead"
        >
          <option value="">All Front Desk</option>
          {frontDesk.map((fd) => (
            <option key={fd.id} value={fd.name}>{fd.name}</option>
          ))}
        </select>

        {/* Filter by Mechanic */}
        <select
          value={filterMechanic}
          onChange={(e) => setFilterMechanic(e.target.value)}
          className={`text-sm pl-2 pr-7 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem_1rem] ${
            filterMechanic
              ? 'border-violet-400 dark:border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
              : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236b7280'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z'/%3E%3C/svg%3E")` }}
          title="Filter by Mechanic"
        >
          <option value="">All Mechanics</option>
          {mechanics.map((m) => (
            <option key={m.id} value={m.name}>{getMechanicDisplay(m)}</option>
          ))}
        </select>

        {/* Prominent theme toggle */}
        <button
          onClick={toggleTheme}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border font-medium text-sm transition-all ${
            theme === 'dark'
              ? 'bg-gray-800 border-gray-600 text-yellow-400 hover:bg-gray-700'
              : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
          }`}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? (
            <>
              <Moon className="w-4 h-4" />
              <span className="hidden sm:inline">Dark</span>
            </>
          ) : (
            <>
              <Sun className="w-4 h-4" />
              <span className="hidden sm:inline">Light</span>
            </>
          )}
        </button>

        <button
          onClick={openEodModal}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
        >
          <FileText className="w-4 h-4" />
          <span className="hidden sm:inline">EOD Report</span>
        </button>

        <button
          onClick={openIntakeModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Intake
        </button>
      </div>
    </header>
  );
}
