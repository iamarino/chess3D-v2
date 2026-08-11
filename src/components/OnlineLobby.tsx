'use client';

import { useState } from 'react';
import { useNetworkStore } from '@/store/useNetworkStore';
import { useUIStore } from '@/store/useUIStore';
import { getDefaultWsUrl } from '@/network/NetworkManager';

const COLOR_LABEL: Record<string, string> = {
  hero: 'Heróis',
  villain: 'Vilões',
};

export function OnlineLobby() {
  const isOpen = useUIStore((s) => s.isOnlineLobbyOpen);
  const closeLobby = useUIStore((s) => s.closeOnlineLobby);

  const status = useNetworkStore((s) => s.status);
  const roomId = useNetworkStore((s) => s.roomId);
  const myColor = useNetworkStore((s) => s.myColor);
  const errorMessage = useNetworkStore((s) => s.errorMessage);
  const createRoom = useNetworkStore((s) => s.createRoom);
  const joinRoom = useNetworkStore((s) => s.joinRoom);
  const leave = useNetworkStore((s) => s.leave);

  const [joinCode, setJoinCode] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const resolvedUrl = customUrl.trim() || getDefaultWsUrl();

  const handleCopy = () => {
    if (!roomId) return;
    void navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6"
      onClick={closeLobby}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900/95 p-6 text-zinc-100 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold uppercase tracking-widest">Jogar Online</h2>
          <button
            type="button"
            onClick={closeLobby}
            className="rounded-full bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
          >
            Fechar
          </button>
        </div>

        {status === 'offline' && (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => createRoom(resolvedUrl)}
              className="rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
            >
              Criar sala
            </button>

            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="Código da sala"
                maxLength={5}
                className="min-w-0 flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm uppercase tracking-widest placeholder:text-zinc-500 placeholder:normal-case"
              />
              <button
                type="button"
                onClick={() => joinRoom(resolvedUrl, joinCode)}
                disabled={joinCode.trim().length === 0}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Entrar
              </button>
            </div>

            <details className="text-xs text-zinc-400">
              <summary className="cursor-pointer select-none">Servidor (avançado)</summary>
              <input
                type="text"
                value={customUrl}
                onChange={(event) => setCustomUrl(event.target.value)}
                placeholder={getDefaultWsUrl()}
                className="mt-2 w-full rounded-lg bg-white/10 px-3 py-2 text-xs placeholder:text-zinc-500"
              />
            </details>

            {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}
          </div>
        )}

        {status === 'connecting' && <p className="text-sm text-zinc-300">Conectando ao servidor…</p>}

        {status === 'waiting' && roomId && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-zinc-300">Compartilhe este código com seu adversário:</p>
            <p className="text-4xl font-bold tracking-[0.3em] text-amber-400">{roomId}</p>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              {copied ? 'Copiado!' : 'Copiar código'}
            </button>
            <p className="text-xs text-zinc-500">Aguardando adversário entrar…</p>
            <button
              type="button"
              onClick={leave}
              className="mt-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-300 hover:bg-red-500/30"
            >
              Cancelar
            </button>
          </div>
        )}

        {status === 'matched' && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-zinc-300">Conectado! Sala {roomId}</p>
            <p className="text-lg font-semibold">
              Você joga como{' '}
              <span className={myColor === 'hero' ? 'text-amber-400' : 'text-purple-400'}>
                {myColor ? COLOR_LABEL[myColor] : ''}
              </span>
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={closeLobby}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
              >
                Jogar
              </button>
              <button
                type="button"
                onClick={leave}
                className="rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-300 hover:bg-red-500/30"
              >
                Sair da sala
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-red-400">{errorMessage ?? 'Erro de conexão.'}</p>
            <button
              type="button"
              onClick={leave}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
