import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface WorkspaceState {
  /** null = fall back to the user's personal workspace (backend default). */
  currentWorkspaceId: string | null;
  setCurrentWorkspaceId: (id: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      currentWorkspaceId: null,
      setCurrentWorkspaceId: (id) => set({ currentWorkspaceId: id }),
    }),
    {
      name: 'task-manager-workspace',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
