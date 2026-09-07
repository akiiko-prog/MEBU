import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createMMKVStorage } from "../global";

interface FlagsStorage {
  /** True if the app is running with the Google reviewer demo account */
  isDemoMode: boolean;
  setDemoMode: (value: boolean) => void;
}

export const useFlagsStore = create<FlagsStorage>()(
  persist(
    (set) => ({
      isDemoMode: false,
      setDemoMode: (value) => set({ isDemoMode: value }),
    }),
    {
      name: "flags-storage",
      storage: createMMKVStorage<FlagsStorage>("flags-storage"),
    }
  )
);
