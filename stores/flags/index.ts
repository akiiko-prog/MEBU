import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createMMKVStorage } from "../global";

interface FlagsStorage {
  /** True if the app is running with the Google reviewer demo account */
  isDemoMode: boolean;
  setDemoMode: (value: boolean) => void;
  /** True if the user signed in as a teacher: grades and absences are hidden */
  isTeacher: boolean;
  setTeacher: (value: boolean) => void;
}

export const useFlagsStore = create<FlagsStorage>()(
  persist(
    (set) => ({
      isDemoMode: false,
      setDemoMode: (value) => set({ isDemoMode: value }),
      isTeacher: false,
      setTeacher: (value) => set({ isTeacher: value }),
    }),
    {
      name: "flags-storage",
      storage: createMMKVStorage<FlagsStorage>("flags-storage"),
    }
  )
);
