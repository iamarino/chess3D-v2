'use client';

import { useGameStore } from '@/store/useGameStore';
import { useNetworkStore } from '@/store/useNetworkStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useUIStore } from '@/store/useUIStore';
import { audioManager } from '@/three/AudioManager';
import { GlobeIcon, MenuIcon, RestartIcon, SpeakerOffIcon, SpeakerOnIcon, UndoIcon } from './icons';

function ToolButton({
  active,
  disabled,
  label,
  emphasize,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  emphasize?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={
        'flex h-11 items-center justify-center gap-2.5 rounded-lg px-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:w-11 lg:w-auto lg:justify-start lg:px-3 ' +
        (active
          ? 'bg-amber-400/25 text-amber-300 ring-1 ring-amber-400/50'
          : emphasize
            ? 'text-emerald-300 hover:bg-emerald-400/15 hover:text-emerald-200'
            : 'text-zinc-300 hover:bg-white/10 hover:text-white')
      }
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{children}</span>
      <span className={'hidden whitespace-nowrap text-sm lg:inline ' + (emphasize ? 'font-semibold' : 'font-medium')}>
        {label}
      </span>
    </button>
  );
}

/** Vertical icon toolbar pinned to the left edge, editor-style — app-level actions (menu, online, audio). */
export function LeftToolbar() {
  const toggleMenu = useUIStore((s) => s.toggleMenu);
  const toggleOnlineLobby = useUIStore((s) => s.toggleOnlineLobby);
  const muted = useSettingsStore((s) => s.muted);
  const setMuted = useSettingsStore((s) => s.setMuted);
  const networkStatus = useNetworkStore((s) => s.status);
  const isOnline = networkStatus === 'matched';
  const historyLength = useGameStore((s) => s.state.history.length);
  const undo = useGameStore((s) => s.undo);
  const reset = useGameStore((s) => s.reset);

  const withButtonSound = (action: () => void) => () => {
    audioManager.play('button');
    action();
  };

  return (
    // Em telas pequenas o toolbar fica deitado, encostado no topo (menos
    // largura horizontal disponível pro tabuleiro); a partir de `sm` volta a
    // ficar em pé, encostado na borda esquerda e centralizado verticalmente.
    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center sm:inset-x-auto sm:top-1/2 sm:left-0 sm:-translate-y-1/2 sm:justify-start">
      <div className="pointer-events-auto flex flex-row gap-1 rounded-b-xl border border-white/10 bg-zinc-900/70 p-1.5 backdrop-blur-md sm:flex-col sm:rounded-b-none sm:rounded-r-xl">
        <ToolButton label="Menu" onClick={withButtonSound(toggleMenu)}>
          <MenuIcon />
        </ToolButton>
        <ToolButton
          label={isOnline ? 'Online' : 'Jogar Online'}
          active={isOnline}
          emphasize={!isOnline}
          onClick={withButtonSound(toggleOnlineLobby)}
        >
          <GlobeIcon />
        </ToolButton>
        <div className="mx-0.5 w-px self-stretch bg-white/10 sm:mx-0 sm:my-0.5 sm:h-px sm:w-auto sm:self-auto" />
        <ToolButton label={muted ? 'Som: Desligado' : 'Som: Ligado'} onClick={() => setMuted(!muted)}>
          {muted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
        </ToolButton>
        <div className="mx-0.5 w-px self-stretch bg-white/10 sm:mx-0 sm:my-0.5 sm:h-px sm:w-auto sm:self-auto" />
        <ToolButton
          label="Desfazer"
          disabled={historyLength === 0 || isOnline}
          onClick={withButtonSound(undo)}
        >
          <UndoIcon />
        </ToolButton>
        <ToolButton label="Reiniciar" disabled={isOnline} onClick={withButtonSound(reset)}>
          <RestartIcon />
        </ToolButton>
      </div>
    </div>
  );
}
