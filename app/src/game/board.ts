export const BOARD_SIZE = 100

// Classic fixed board layout, per plan decision (.plan/001-2026-07-16-snakes-and-ladders-mvp.md).
export const LADDERS: Readonly<Record<number, number>> = {
  1: 38,
  4: 14,
  9: 31,
  21: 42,
  28: 84,
  36: 44,
  51: 67,
  71: 91,
  80: 100
}

export const SNAKES: Readonly<Record<number, number>> = {
  16: 6,
  47: 26,
  49: 11,
  56: 53,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  98: 78
}

export function getShortcut(square: number): number | null {
  if (square in LADDERS) return LADDERS[square]
  if (square in SNAKES) return SNAKES[square]
  return null
}

export interface SquarePosition {
  row: number
  col: number
}

// Boustrophedon layout: row 0 holds squares 1-10 (left-to-right),
// row 1 holds squares 11-20 (right-to-left), and so on.
export function getSquarePosition(square: number): SquarePosition {
  const index = square - 1
  const row = Math.floor(index / 10)
  const indexInRow = index % 10
  const col = row % 2 === 0 ? indexInRow : 9 - indexInRow
  return { row, col }
}

export interface SquarePercent {
  topPercent: number
  leftPercent: number
}

// Percent-based coordinates (0-90, top-left of each 10%-wide cell) for
// overlays that need to sit above the CSS grid, e.g. pieces and the
// snake/ladder connector lines. Row 9 (squares 91-100) renders at the top.
export function getSquareCenterPercent(square: number): SquarePercent {
  const { row, col } = getSquarePosition(square)
  return {
    topPercent: (9 - row) * 10,
    leftPercent: col * 10
  }
}
