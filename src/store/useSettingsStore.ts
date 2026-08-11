import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_BOARD_SCHEME_ID } from '@/themes/boardSchemes';

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export interface PieceModelOffset {
  x: number;
  y: number;
  z: number;
}

export const DEFAULT_PIECE_MODEL_OFFSET: PieceModelOffset = { x: 0, y: 0, z: 0 };

/** `${color}-${type}`, e.g. "hero-pawn" — one entry per piece model, matched against `PieceColor`/`PieceType`. */
export type PieceModelKey = string;

interface SettingsState {
  quality: GraphicsQuality;
  cinematicCamera: boolean;
  masterVolume: number;
  effectsVolume: number;
  muted: boolean;
  boardScheme: string;
  showLegalMoves: boolean;
  pieceWalkAnimation: boolean;
  /**
   * Multiplicador da cadência autoral da caminhada (1 = o ritmo em que o
   * clipe foi animado). Não é uma duração: a duração sai da distância, porque
   * a peça avança pelo root motion do clipe — dois passos para meia casa não
   * existem. Mexer aqui muda o ritmo da caminhada inteira sem descolar o pé
   * do chão.
   */
  pieceWalkTempo: number;
  /**
   * Per-model local position correction, keyed by `${color}-${type}`
   * (e.g. "hero-pawn") — some Tripo-generated meshes aren't centered on
   * their own origin, so the piece doesn't sit centered on its square.
   * Only "hero-pawn" is exposed in settings today; the map is general so
   * every piece can get its own correction later without a schema change.
   */
  pieceModelOffsets: Record<PieceModelKey, PieceModelOffset>;
  /** Dev-only fine grid over the hero pawn's home square, for reading off offsets while calibrating. */
  showCalibrationRuler: boolean;
  setQuality: (quality: GraphicsQuality) => void;
  setCinematicCamera: (enabled: boolean) => void;
  setMasterVolume: (volume: number) => void;
  setEffectsVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setBoardScheme: (schemeId: string) => void;
  setShowLegalMoves: (show: boolean) => void;
  setPieceWalkAnimation: (enabled: boolean) => void;
  setPieceWalkTempo: (tempo: number) => void;
  setPieceModelOffset: (key: PieceModelKey, offset: PieceModelOffset) => void;
  setShowCalibrationRuler: (show: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      quality: 'high',
      cinematicCamera: true,
      masterVolume: 0.8,
      effectsVolume: 0.6,
      muted: false,
      boardScheme: DEFAULT_BOARD_SCHEME_ID,
      showLegalMoves: true,
      pieceWalkAnimation: true,
      pieceWalkTempo: 1.15,
      // Peão vilão: 1.1x mais raso que o herói e a malha não fica centrada
      // sozinha — sem isso ele fica visivelmente à frente do centro da
      // casa em relação ao peão herói.
      pieceModelOffsets: { 'villain-pawn': { x: 0, y: 0, z: -0.17 } },
      showCalibrationRuler: false,
      setQuality: (quality) => set({ quality }),
      setCinematicCamera: (cinematicCamera) => set({ cinematicCamera }),
      setMasterVolume: (masterVolume) => set({ masterVolume }),
      setEffectsVolume: (effectsVolume) => set({ effectsVolume }),
      setMuted: (muted) => set({ muted }),
      setBoardScheme: (boardScheme) => set({ boardScheme }),
      setShowLegalMoves: (showLegalMoves) => set({ showLegalMoves }),
      setPieceWalkAnimation: (pieceWalkAnimation) => set({ pieceWalkAnimation }),
      setPieceWalkTempo: (pieceWalkTempo) => set({ pieceWalkTempo }),
      setPieceModelOffset: (key, offset) =>
        set((state) => ({ pieceModelOffsets: { ...state.pieceModelOffsets, [key]: offset } })),
      setShowCalibrationRuler: (showCalibrationRuler) => set({ showCalibrationRuler }),
    }),
    {
      name: 'chess3d-settings',
      version: 2,
      // v0 guardava `pieceWalkDuration` (segundos fixos por jogada) e
      // `pieceWalkOvershoot` (calibração do ponto de parada). Os dois sumiram
      // quando a caminhada passou a ser dirigida pelo root motion do clipe: a
      // duração agora vem da distância e a parada é exata por construção.
      // Descartar é o certo — um overshoot herdado voltaria a deslocar a peça.
      migrate: (persisted, version) => {
        let state = persisted as Partial<SettingsState> & {
          pieceWalkDuration?: number;
          pieceWalkOvershoot?: number;
        };

        if (version < 1) {
          const { pieceWalkDuration, pieceWalkOvershoot, ...rest } = state ?? {};
          void pieceWalkDuration;
          void pieceWalkOvershoot;
          state = rest;
        }

        if (version < 2) {
          // O objeto `pieceModelOffsets` salvo é substituído inteiro pelo persist
          // (sem merge profundo), então o default novo do peão vilão só chega em
          // sessões antigas — que já calibraram o peão herói — por aqui.
          const offsets = state?.pieceModelOffsets ?? {};
          state = {
            ...state,
            pieceModelOffsets: { 'villain-pawn': { x: 0, y: 0, z: -0.17 }, ...offsets },
          };
        }

        return state;
      },
    },
  ),
);

interface QualityPreset {
  dpr: [number, number];
  shadows: boolean;
  shadowMapSize: number;
  particleMultiplier: number;
  ambientMotes: number;
  contactShadows: boolean;
}

export const QUALITY_PRESETS: Record<GraphicsQuality, QualityPreset> = {
  low: {
    dpr: [1, 1],
    shadows: false,
    shadowMapSize: 512,
    particleMultiplier: 0.35,
    ambientMotes: 0,
    contactShadows: false,
  },
  medium: {
    dpr: [1, 1.25],
    shadows: true,
    shadowMapSize: 1024,
    particleMultiplier: 0.6,
    ambientMotes: 15,
    contactShadows: true,
  },
  high: {
    dpr: [1, 1.5],
    shadows: true,
    shadowMapSize: 2048,
    particleMultiplier: 1,
    ambientMotes: 40,
    contactShadows: true,
  },
  ultra: {
    dpr: [1, 2],
    shadows: true,
    shadowMapSize: 4096,
    particleMultiplier: 1.4,
    ambientMotes: 60,
    contactShadows: true,
  },
};
