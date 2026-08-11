export const BOARD_SIZE = 8;
export const SQUARE_SIZE = 1;

const FILE_A_CODE = 'a'.charCodeAt(0);

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function squareToPosition(square: string): [number, number, number] {
  const file = square.charCodeAt(0) - FILE_A_CODE;
  const rank = parseInt(square[1], 10) - 1;
  const x = (file - (BOARD_SIZE - 1) / 2) * SQUARE_SIZE;
  const z = ((BOARD_SIZE - 1) / 2 - rank) * SQUARE_SIZE;
  return [x, 0, z];
}
