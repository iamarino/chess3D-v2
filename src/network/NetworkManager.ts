import { EventManager } from '@/core/game/EventManager';
import type { Move, PieceColor } from '@/core/chess/types';

export type NetworkStatus = 'offline' | 'connecting' | 'waiting' | 'matched' | 'error';

export interface NetworkEventMap {
  'status-changed': { status: NetworkStatus };
  'room-created': { roomId: string; color: PieceColor };
  'room-joined': { roomId: string; color: PieceColor };
  'opponent-joined': Record<string, never>;
  'opponent-left': Record<string, never>;
  'move-received': { move: Move };
  error: { message: string };
}

/** Resolves the WebSocket relay URL for this same deployment (same host/port, path /ws). */
export function getDefaultWsUrl(): string {
  if (typeof window === 'undefined') return '';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

/**
 * Thin WebSocket client for the room-relay server (see server.js). Knows
 * nothing about chess rules — it just create/joins a 2-player room and
 * ferries opaque move payloads between the two sockets.
 */
export class NetworkManager {
  readonly events = new EventManager<NetworkEventMap>();
  private ws: WebSocket | null = null;
  private roomId: string | null = null;
  status: NetworkStatus = 'offline';

  private setStatus(status: NetworkStatus): void {
    this.status = status;
    this.events.emit('status-changed', { status });
  }

  private openSocket(url: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(url);
      ws.onopen = () => {
        settled = true;
        resolve(ws);
      };
      ws.onerror = () => {
        if (!settled) reject(new Error('connection failed'));
      };
      ws.onmessage = (event) => this.handleMessage(event);
      ws.onclose = () => {
        this.ws = null;
        if (this.status !== 'offline') {
          this.events.emit('opponent-left', {});
          this.roomId = null;
          this.setStatus('offline');
        }
      };
    });
  }

  private handleMessage(event: MessageEvent): void {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(event.data as string);
    } catch {
      return;
    }

    switch (data.type) {
      case 'created':
        this.roomId = data.roomId as string;
        this.setStatus('waiting');
        this.events.emit('room-created', { roomId: data.roomId as string, color: data.color as PieceColor });
        break;
      case 'joined':
        this.roomId = data.roomId as string;
        this.setStatus('matched');
        this.events.emit('room-joined', { roomId: data.roomId as string, color: data.color as PieceColor });
        break;
      case 'opponent-joined':
        this.setStatus('matched');
        this.events.emit('opponent-joined', {});
        break;
      case 'opponent-left':
        this.events.emit('opponent-left', {});
        break;
      case 'move':
        this.events.emit('move-received', { move: data.move as Move });
        break;
      case 'error':
        this.setStatus('error');
        this.events.emit('error', { message: data.message as string });
        break;
      default:
        break;
    }
  }

  async createRoom(url: string): Promise<void> {
    this.setStatus('connecting');
    try {
      this.ws = await this.openSocket(url);
      this.send({ type: 'create' });
    } catch {
      this.setStatus('error');
      this.events.emit('error', { message: 'Não foi possível conectar ao servidor.' });
    }
  }

  async joinRoom(url: string, roomId: string): Promise<void> {
    this.setStatus('connecting');
    try {
      this.ws = await this.openSocket(url);
      this.send({ type: 'join', roomId: roomId.trim().toUpperCase() });
    } catch {
      this.setStatus('error');
      this.events.emit('error', { message: 'Não foi possível conectar ao servidor.' });
    }
  }

  sendMove(move: Move): void {
    if (!this.roomId) return;
    this.send({ type: 'move', roomId: this.roomId, move });
  }

  private send(data: unknown): void {
    this.ws?.send(JSON.stringify(data));
  }

  leave(): void {
    if (this.roomId) this.send({ type: 'leave', roomId: this.roomId });
    this.ws?.close();
    this.ws = null;
    this.roomId = null;
    this.setStatus('offline');
  }

  getRoomId(): string | null {
    return this.roomId;
  }
}

export const networkManager = new NetworkManager();
