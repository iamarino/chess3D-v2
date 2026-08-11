'use client';

import { useNetworkStore } from '@/store/useNetworkStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useUIStore } from '@/store/useUIStore';
import { audioManager } from '@/three/AudioManager';
import { GlobeIcon, MenuIcon, SpeakerOffIcon, SpeakerOnIcon } from './icons';

function ToolButton({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={
        'flex h-11 w-11 items-center justify-center rounded-lg transition-colors ' +
        (active
          ? 'bg-amber-400/25 text-amber-300 ring-1 ring-amber-400/50'
          : 'text-zinc-300 hover:bg-white/10 hover:text-white')
      }
    >
      {children}
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

  const withButtonSound = (action: () => void) => () => {
    audioManager.play('button');
    action();
  };

  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center">
      <div className="pointer-events-auto flex flex-col gap-1 rounded-r-xl border border-white/10 bg-zinc-900/70 p-1.5 backdrop-blur-md">
        <ToolButton label="Menu" onClick={withButtonSound(toggleMenu)}>
          <MenuIcon />
        </ToolButton>
        <ToolButton label={isOnline ? 'Online' : 'Jogar Online'} active={isOnline} onClick={withButtonSound(toggleOnlineLobby)}>
          <GlobeIcon />
        </ToolButton>
        <div className="my-0.5 h-px bg-white/10" />
        <ToolButton label={muted ? 'Som: Desligado' : 'Som: Ligado'} onClick={() => setMuted(!muted)}>
          {muted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
        </ToolButton>
      </div>
    </div>
  );
}
