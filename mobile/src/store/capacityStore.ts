import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface CapacityState {
  weeklyHours: number;
  setWeeklyHours: (h: number) => void;
}

export const useCapacityStore = create<CapacityState>()(
  persist(
    (set) => ({
      weeklyHours: 20,
      setWeeklyHours: (h) => set({ weeklyHours: Math.max(1, Math.min(168, Math.round(h) || 1)) }),
    }),
    {
      name: 'momentum-capacity',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
