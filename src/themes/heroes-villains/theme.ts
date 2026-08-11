import type { ChessTheme } from '../ThemeDefinition';

export const heroesVillainsTheme: ChessTheme = {
  id: 'heroes-villains',
  name: 'Heróis vs Vilões',
  board: {
    lightSquareColor: '#e8d9b5',
    darkSquareColor: '#5c3d2e',
  },
  pieces: {
    hero: {
      primaryColor: '#3f7dd6',
      accentColor: '#f5c518',
    },
    villain: {
      primaryColor: '#3a1f47',
      accentColor: '#8e2de2',
    },
  },
  environment: {
    backgroundColor: '#bfe0f2',
  },
};
