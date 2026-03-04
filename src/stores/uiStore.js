import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useUIStore = create(
  persist(
    (set) => ({
      theme: 'light',
      activeTab: 'floor',
      intakeModalOpen: false,
      intakePreFill: null, // { appointmentDate, preferredTime } for calendar click-to-add
      searchQuery: '',
      filterStatus: null,
      filterUnassigned: false,
      filterPartsOrdered: false,
      editingJobId: null,
      eodModalOpen: false,
      bayAssignmentPending: null, // { jobId, targetStatus } when bay assignment needed
      bayMapView: 'max', // 'max' or 'min'
      allCardsCollapsed: null, // null = individual, true = all collapsed, false = all expanded
      filterFrontDesk: '',
      filterMechanic: '',
      cancelingJobId: null, // job ID for the Cancel Intake modal
      floorView: 'board', // 'board' or 'list' — Live Floor view mode
      hiddenStatuses: [], // statuses to hide from the floor (e.g. ['DONE'])
      activeJobsMode: false, // preset: hide Done & Cancelled

      toggleTheme: () =>
        set((state) => {
          const next = state.theme === 'light' ? 'dark' : 'light';
          document.documentElement.classList.toggle('dark', next === 'dark');
          return { theme: next };
        }),

      setActiveTab: (tab) => set({ activeTab: tab }),
      openIntakeModal: (preFill) => set({ intakeModalOpen: true, intakePreFill: preFill || null }),
      closeIntakeModal: () => set({ intakeModalOpen: false, intakePreFill: null }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setFilterStatus: (s) => set({ filterStatus: s }),
      setFilterUnassigned: (v) => set({ filterUnassigned: v }),
      setFilterPartsOrdered: (v) => set({ filterPartsOrdered: v }),
      setEditingJobId: (id) => set({ editingJobId: id }),
      openEodModal: () => set({ eodModalOpen: true }),
      closeEodModal: () => set({ eodModalOpen: false }),
      setBayAssignmentPending: (val) => set({ bayAssignmentPending: val }),
      clearBayAssignment: () => set({ bayAssignmentPending: null }),
      toggleBayMapView: () => set((s) => ({ bayMapView: s.bayMapView === 'max' ? 'min' : 'max' })),
      setAllCardsCollapsed: (v) => set({ allCardsCollapsed: v }),
      setFilterFrontDesk: (v) => set({ filterFrontDesk: v }),
      setFilterMechanic: (v) => set({ filterMechanic: v }),
      setCancelingJobId: (id) => set({ cancelingJobId: id }),
      setFloorView: (v) => set({ floorView: v }),
      toggleHiddenStatus: (status) =>
        set((s) => {
          const next = s.hiddenStatuses.includes(status)
            ? s.hiddenStatuses.filter((st) => st !== status)
            : [...s.hiddenStatuses, status];
          // If manual toggle changes, turn off activeJobsMode
          return { hiddenStatuses: next, activeJobsMode: false };
        }),
      setActiveJobsMode: (on) =>
        set({
          activeJobsMode: on,
          hiddenStatuses: on ? ['DONE'] : [],
        }),
      clearStatusFilters: () => set({ hiddenStatuses: [], activeJobsMode: false }),
    }),
    {
      name: 'cbros-ui',
      partialize: (state) => ({ theme: state.theme, activeTab: state.activeTab, floorView: state.floorView, hiddenStatuses: state.hiddenStatuses, activeJobsMode: state.activeJobsMode }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme === 'dark') {
          document.documentElement.classList.add('dark');
        }
      },
    }
  )
);
