import type { PieceColor, PieceType } from '@/core/chess/types';

export interface PieceThemeVisual {
  primaryColor: string;
  accentColor: string;
  modelUrl?: string;
}

export interface ChessTheme {
  id: string;
  name: string;
  board: {
    lightSquareColor: string;
    darkSquareColor: string;
  };
  pieces: Record<PieceColor, PieceThemeVisual>;
  environment: {
    backgroundColor: string;
  };
}

export type PieceGeometryKind = PieceType;
