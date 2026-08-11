import { create } from 'zustand';

interface UIState {
  isMenuOpen: boolean;
  isOnlineLobbyOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
  openOnlineLobby: () => void;
  closeOnlineLobby: () => void;
  toggleOnlineLobby: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isMenuOpen: false,
  isOnlineLobbyOpen: false,
  openMenu: () => set({ isMenuOpen: true }),
  closeMenu: () => set({ isMenuOpen: false }),
  toggleMenu: () => set((s) => ({ isMenuOpen: !s.isMenuOpen })),
  openOnlineLobby: () => set({ isOnlineLobbyOpen: true }),
  closeOnlineLobby: () => set({ isOnlineLobbyOpen: false }),
  toggleOnlineLobby: () => set((s) => ({ isOnlineLobbyOpen: !s.isOnlineLobbyOpen })),
}));
