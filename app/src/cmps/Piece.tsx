import { getSquareCenterPercent } from '../game/board'
import type { PlayerId } from '../game/types'

interface PieceProps {
  player: PlayerId
  square: number
}

// Square 0 means "not yet on the board" - render at square 1's spot with a
// per-player offset so both pieces stay visible when sharing a square.
export function Piece({ player, square }: PieceProps) {
  const displaySquare = square === 0 ? 1 : square
  const { topPercent, leftPercent } = getSquareCenterPercent(displaySquare)
  const offset = player === 'human' ? -2 : 2

  return (
    <div
      className={`piece piece--${player}`}
      style={{
        top: `${topPercent + 5}%`,
        left: `${leftPercent + 5 + offset}%`
      }}
      aria-label={`${player} piece on square ${square}`}
    />
  )
}
