export interface BoardColorScheme {
  id: string;
  name: string;
  lightSquareColor: string;
  darkSquareColor: string;
}

export const BOARD_COLOR_SCHEMES: BoardColorScheme[] = [
  { id: 'classic', name: 'Clássico', lightSquareColor: '#e8d9b5', darkSquareColor: '#5c3d2e' },
  { id: 'blackwhite', name: 'Preto e Branco', lightSquareColor: '#f2f2f2', darkSquareColor: '#161616' },
  { id: 'emerald', name: 'Esmeralda', lightSquareColor: '#dce8d9', darkSquareColor: '#1f4d3d' },
  { id: 'sapphire', name: 'Safira', lightSquareColor: '#dce6f2', darkSquareColor: '#1f2f4d' },
];

export const DEFAULT_BOARD_SCHEME_ID = 'classic';

export function getBoardScheme(id: string): BoardColorScheme {
  return BOARD_COLOR_SCHEMES.find((scheme) => scheme.id === id) ?? BOARD_COLOR_SCHEMES[0];
}
