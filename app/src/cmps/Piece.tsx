import { getSquareCenterPercent } from '../game/board'

interface PieceProps {
  colorIndex: number
  square: number
  label: string
}

// Offsets for up to 4 pieces sharing a square. Indices 0/1 match the
// original human/computer horizontal-only offsets exactly (no vertical
// shift), so the existing vs-computer board keeps its current look;
// indices 2/3 (multiplayer's 3rd/4th player) spread vertically instead.
const OFFSETS = [
  { top: 0, left: -2 },
  { top: 0, left: 2 },
  { top: -3, left: 0 },
  { top: 3, left: 0 }
]

// Square 0 means "not yet on the board" - render at square 1's spot with a
// per-player offset so pieces sharing a square stay visible.
export function Piece({ colorIndex, square, label }: PieceProps) {
  const displaySquare = square === 0 ? 1 : square
  const { topPercent, leftPercent } = getSquareCenterPercent(displaySquare)
  const offset = OFFSETS[colorIndex % OFFSETS.length]

  return (
    <div
      className={`piece piece--${colorIndex}`}
      style={{
        top: `${topPercent + 5 + offset.top}%`,
        left: `${leftPercent + 5 + offset.left}%`
      }}
      aria-label={`${label} piece on square ${square}`}
    />
  )
}
