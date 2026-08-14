'use client';

import { useEffect, useState } from 'react';
import type { GraphicsQuality, Scenario } from '@/store/useSettingsStore';
import { DEFAULT_PIECE_MODEL_OFFSET, useSettingsStore } from '@/store/useSettingsStore';
import { useNetworkStore } from '@/store/useNetworkStore';
import { useUIStore } from '@/store/useUIStore';
import { BOARD_COLOR_SCHEMES } from '@/themes/boardSchemes';

const THEMES = [
  { id: 'heroes-villains', name: 'Heróis vs Vilões', available: true },
  { id: 'medieval', name: 'Medieval', available: false },
  { id: 'samurai', name: 'Samurai', available: false },
  { id: 'sci-fi', name: 'Sci-Fi', available: false },
];

const SCENARIOS: { value: Scenario; label: string; description: string }[] = [
  { value: 'castle-day', label: 'Castelo ao meio-dia', description: 'Céu claro, sol a pino' },
  { value: 'castle-night', label: 'Cerco noturno', description: 'Lua, estrelas e muralha sob luar' },
];

const QUALITY_OPTIONS: { value: GraphicsQuality; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'ultra', label: 'Ultra' },
];

// A plain <input type="number"> parses with the browser's locale decimal
// separator (comma in pt-BR) — typing "0.7" silently produced 3, not 0.7.
// This text field does its own parsing, accepting either "." or ",", and
// only commits on blur/Enter so partial input like "0." isn't clobbered.
function DecimalField({
  value,
  onCommit,
  min,
  max,
  disabled,
}: {
  value: number;
  onCommit: (value: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
}) {
  const [text, setText] = useState(() => value.toFixed(2));
  useEffect(() => {
    setText(value.toFixed(2));
  }, [value]);

  function commit(raw: string) {
    const normalized = raw.replace(',', '.').trim();
    const parsed = Number(normalized);
    if (normalized !== '' && normalized !== '-' && !Number.isNaN(parsed)) {
      onCommit(Math.min(max, Math.max(min, parsed)));
    } else {
      setText(value.toFixed(2));
    }
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={(event) => commit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit(event.currentTarget.value);
          event.currentTarget.blur();
        }
      }}
      disabled={disabled}
      className="w-16 rounded border border-white/10 bg-white/10 px-1 py-0.5 text-right text-zinc-100"
    />
  );
}

function AxisOffsetRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <DecimalField value={value} onCommit={onChange} min={-0.5} max={0.5} />
      </label>
      <input
        type="range"
        min={-0.5}
        max={0.5}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      />
    </div>
  );
}

export function SettingsMenu() {
  const isOpen = useUIStore((s) => s.isMenuOpen);
  const closeMenu = useUIStore((s) => s.closeMenu);

  const quality = useSettingsStore((s) => s.quality);
  const setQuality = useSettingsStore((s) => s.setQuality);
  const scenario = useSettingsStore((s) => s.scenario);
  const setScenario = useSettingsStore((s) => s.setScenario);
  const cinematicCamera = useSettingsStore((s) => s.cinematicCamera);
  const setCinematicCamera = useSettingsStore((s) => s.setCinematicCamera);
  const isOnline = useNetworkStore((s) => s.status) === 'matched';
  const muted = useSettingsStore((s) => s.muted);
  const setMuted = useSettingsStore((s) => s.setMuted);
  const masterVolume = useSettingsStore((s) => s.masterVolume);
  const setMasterVolume = useSettingsStore((s) => s.setMasterVolume);
  const effectsVolume = useSettingsStore((s) => s.effectsVolume);
  const setEffectsVolume = useSettingsStore((s) => s.setEffectsVolume);
  const boardScheme = useSettingsStore((s) => s.boardScheme);
  const setBoardScheme = useSettingsStore((s) => s.setBoardScheme);
  const discoFloor = useSettingsStore((s) => s.discoFloor);
  const setDiscoFloor = useSettingsStore((s) => s.setDiscoFloor);
  const showLegalMoves = useSettingsStore((s) => s.showLegalMoves);
  const setShowLegalMoves = useSettingsStore((s) => s.setShowLegalMoves);
  const pieceWalkAnimation = useSettingsStore((s) => s.pieceWalkAnimation);
  const setPieceWalkAnimation = useSettingsStore((s) => s.setPieceWalkAnimation);
  const pieceWalkTempo = useSettingsStore((s) => s.pieceWalkTempo);
  const setPieceWalkTempo = useSettingsStore((s) => s.setPieceWalkTempo);
  const heroPawnOffset = useSettingsStore((s) => s.pieceModelOffsets['hero-pawn'] ?? DEFAULT_PIECE_MODEL_OFFSET);
  const setPieceModelOffset = useSettingsStore((s) => s.setPieceModelOffset);
  const showCalibrationRuler = useSettingsStore((s) => s.showCalibrationRuler);
  const setShowCalibrationRuler = useSettingsStore((s) => s.setShowCalibrationRuler);

  if (!isOpen) return null;

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6"
      onClick={closeMenu}
    >
      <div
        className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900/95 p-6 text-zinc-100 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold uppercase tracking-widest">Menu</h2>
          <button
            type="button"
            onClick={closeMenu}
            className="rounded-full bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
          >
            Fechar
          </button>
        </div>

        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">Tema</h3>
          <div className="flex flex-col gap-2">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                disabled={!theme.available}
                className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  theme.available
                    ? 'bg-amber-500/20 text-amber-100'
                    : 'cursor-not-allowed bg-white/5 text-zinc-500'
                }`}
              >
                {theme.name}
                {!theme.available && <span className="ml-2 text-xs">(em breve)</span>}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">Cenário</h3>
          <div className="flex flex-col gap-2">
            {SCENARIOS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setScenario(option.value)}
                className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  scenario === option.value
                    ? 'bg-amber-500/20 text-amber-100'
                    : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                {option.label}
                <span className="block text-xs text-zinc-500">{option.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Qualidade gráfica
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {QUALITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setQuality(option.value)}
                className={`rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                  quality === option.value
                    ? 'bg-amber-500 text-black'
                    : 'bg-white/10 text-zinc-200 hover:bg-white/20'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Esquema do tabuleiro
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {BOARD_COLOR_SCHEMES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setBoardScheme(option.id)}
                className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                  boardScheme === option.id
                    ? 'bg-amber-500 text-black'
                    : 'bg-white/10 text-zinc-200 hover:bg-white/20'
                }`}
              >
                <span className="flex h-5 w-5 overflow-hidden rounded border border-white/30">
                  <span className="h-full w-1/2" style={{ backgroundColor: option.lightSquareColor }} />
                  <span className="h-full w-1/2" style={{ backgroundColor: option.darkSquareColor }} />
                </span>
                {option.name}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Efeitos do tabuleiro
          </h3>
          <label className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
            <span>
              Pista de dança
              <span className="block text-xs text-zinc-500">
                Casas piscam em cores, estilo pista de dança anos 70
              </span>
            </span>
            <input
              type="checkbox"
              checked={discoFloor}
              onChange={(event) => setDiscoFloor(event.target.checked)}
              className="h-4 w-4 shrink-0"
            />
          </label>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">Jogabilidade</h3>
          <label className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
            <span>
              Mostrar movimentos possíveis
              <span className="block text-xs text-zinc-500">Desligue para um jogo mais desafiador</span>
            </span>
            <input
              type="checkbox"
              checked={showLegalMoves}
              onChange={(event) => setShowLegalMoves(event.target.checked)}
              className="h-4 w-4 shrink-0"
            />
          </label>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Animação de peças
          </h3>
          <label className="mb-2 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
            <span>
              Animação de caminhada
              <span className="block text-xs text-zinc-500">Peças com rig (hoje só o peão herói) caminham até a casa</span>
            </span>
            <input
              type="checkbox"
              checked={pieceWalkAnimation}
              onChange={(event) => setPieceWalkAnimation(event.target.checked)}
              className="h-4 w-4 shrink-0"
            />
          </label>
          <div className={`flex flex-col gap-3 px-1 transition-opacity ${pieceWalkAnimation ? '' : 'pointer-events-none opacity-40'}`}>
            <div className="flex flex-col gap-1">
              <label className="flex justify-between text-xs text-zinc-400">
                <span>Ritmo da caminhada</span>
                <span>{pieceWalkTempo.toFixed(2)}×</span>
              </label>
              <input
                type="range"
                min={0.6}
                max={2}
                step={0.05}
                value={pieceWalkTempo}
                onChange={(event) => setPieceWalkTempo(Number(event.target.value))}
                disabled={!pieceWalkAnimation}
                className="w-full"
              />
              <span className="text-xs text-zinc-500">
                1.00× é a cadência em que a animação foi feita. A duração da jogada sai da
                distância — duas casas levam o dobro de passos, não o dobro de pressa.
              </span>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Ajuste de posição — Peão herói
          </h3>
          <label className="mb-3 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
            <span>
              Régua de calibração
              <span className="block text-xs text-zinc-500">
                Grade fina sobre a d2 + régua ao longo da coluna h (torre do lado do rei), do
                início ao fim do tabuleiro — temporária, só para achar os números certos
              </span>
            </span>
            <input
              type="checkbox"
              checked={showCalibrationRuler}
              onChange={(event) => setShowCalibrationRuler(event.target.checked)}
              className="h-4 w-4 shrink-0"
            />
          </label>
          <div className="flex flex-col gap-3 px-1">
            <AxisOffsetRow
              label="Esquerda / Direita (X)"
              value={heroPawnOffset.x}
              onChange={(x) => setPieceModelOffset('hero-pawn', { ...heroPawnOffset, x })}
            />
            <AxisOffsetRow
              label="Cima / Baixo (Y)"
              value={heroPawnOffset.y}
              onChange={(y) => setPieceModelOffset('hero-pawn', { ...heroPawnOffset, y })}
            />
            <AxisOffsetRow
              label="Frente / Trás (Z)"
              value={heroPawnOffset.z}
              onChange={(z) => setPieceModelOffset('hero-pawn', { ...heroPawnOffset, z })}
            />
            <span className="text-xs text-zinc-500">
              Corrige o modelo que não está centralizado na própria casa. Por enquanto só o peão
              herói — as outras peças e o time vilão ganham o mesmo ajuste depois.
            </span>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">Câmera</h3>
          <label className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
            Câmera cinematográfica
            <input
              type="checkbox"
              checked={cinematicCamera}
              disabled={isOnline}
              onChange={(event) => setCinematicCamera(event.target.checked)}
              className="h-4 w-4 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
          {isOnline && (
            <span className="mt-1 block px-1 text-xs text-zinc-500">
              Desligada automaticamente durante partidas online para não travar a câmera entre lances.
            </span>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">Áudio</h3>
          <label className="mb-2 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
            Mudo
            <input
              type="checkbox"
              checked={muted}
              onChange={(event) => setMuted(event.target.checked)}
              className="h-4 w-4"
            />
          </label>
          <div className="mb-2 flex flex-col gap-1 px-1">
            <label className="flex justify-between text-xs text-zinc-400">
              <span>Volume geral</span>
              <span>{Math.round(masterVolume * 100)}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={masterVolume}
              onChange={(event) => setMasterVolume(Number(event.target.value))}
              className="w-full"
            />
          </div>
          <div className="flex flex-col gap-1 px-1">
            <label className="flex justify-between text-xs text-zinc-400">
              <span>Efeitos sonoros</span>
              <span>{Math.round(effectsVolume * 100)}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={effectsVolume}
              onChange={(event) => setEffectsVolume(Number(event.target.value))}
              className="w-full"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
