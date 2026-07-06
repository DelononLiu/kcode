import { create } from 'zustand'

interface UIState {
  scrolledUp: boolean
  pendingCount: number
  setScrolledUp: (v: boolean) => void
  setPendingCount: (n: number) => void
}

export const useUIStore = create<UIState>((set) => ({
  scrolledUp: false,
  pendingCount: 0,
  setScrolledUp: (v) => set({ scrolledUp: v }),
  setPendingCount: (n) => set({ pendingCount: n }),
}))
