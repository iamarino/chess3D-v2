import { create } from 'zustand';
import type { PieceColor } from '@/core/chess/types';
import { networkManager, type NetworkStatus } from '@/network/NetworkManager';

interface NetworkState {
  status: NetworkStatus;
  roomId: string | null;
  myColor: PieceColor | null;
  errorMessage: string | null;
  createRoom: (url: string) => void;
  joinRoom: (url: string, roomId: string) => void;
  leave: () => void;
}

export const useNetworkStore = create<NetworkState>((set) => {
  networkManager.events.on('status-changed', ({ status }) => set({ status }));

  networkManager.events.on('room-created', ({ roomId, color }) => {
    set({ roomId, myColor: color });
  });

  networkManager.events.on('room-joined', ({ roomId, color }) => {
    set({ roomId, myColor: color });
  });

  networkManager.events.on('opponent-left', () => {
    set({ status: 'offline', roomId: null, myColor: null });
  });

  networkManager.events.on('error', ({ message }) => {
    set({ errorMessage: message });
  });

  return {
    status: 'offline',
    roomId: null,
    myColor: null,
    errorMessage: null,
    createRoom: (url) => {
      set({ errorMessage: null });
      void networkManager.createRoom(url);
    },
    joinRoom: (url, roomId) => {
      set({ errorMessage: null });
      void networkManager.joinRoom(url, roomId);
    },
    leave: () => {
      networkManager.leave();
      set({ status: 'offline', roomId: null, myColor: null, errorMessage: null });
    },
  };
});
