'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useNetworkStore } from '@/store/useNetworkStore';
import { networkManager } from '@/network/NetworkManager';

/**
 * Wires the local GameManager to the network layer: local moves go out,
 * remote moves come in and get replayed through the same engine. Starts a
 * fresh, synchronized game the moment both players are in the room.
 */
export function NetworkBridge() {
  const manager = useGameStore((s) => s.manager);
  const status = useNetworkStore((s) => s.status);
  const myColor = useNetworkStore((s) => s.myColor);

  useEffect(() => {
    const offMoved = manager.events.on('piece-moved', ({ move, isRemote }) => {
      if (!isRemote && status === 'matched') {
        networkManager.sendMove(move);
      }
    });
    return () => offMoved();
  }, [manager, status]);

  useEffect(() => {
    const offReceived = networkManager.events.on('move-received', ({ move }) => {
      manager.applyRemoteMove(move.from, move.to, move.promotion);
    });
    return () => offReceived();
  }, [manager]);

  useEffect(() => {
    if (status === 'matched' && myColor) {
      manager.reset();
      manager.setLocalPlayerColor(myColor);
    } else if (status === 'offline') {
      manager.setLocalPlayerColor(null);
    }
  }, [status, myColor, manager]);

  return null;
}
