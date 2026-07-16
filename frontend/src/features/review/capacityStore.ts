import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface CapacityState {
  /** Hours the user reckons they have for tasks this week. */
  weeklyHours: number;
  setWeeklyHours: (h: number) => void;
}

export const useCapacityStore = create<CapacityState>()(
  persist(
    (set) => ({
      weeklyHours: 20,
      setWeeklyHours: (h) => set({ weeklyHours: Math.max(1, Math.min(168, Math.round(h))) }),
    }),
    {
      name: 'task-manager-capacity',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
