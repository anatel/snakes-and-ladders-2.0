import { BOARD_SIZE, LADDERS, SNAKES, getSquareCenterPercent, getSquarePosition } from '../game/board'
import { Piece } from './Piece'
import type { PlayerId } from '../game/types'

interface BoardProps {
  positions: Record<PlayerId, number>
}

const squares = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1)

function Connector({ from, to, kind }: { from: number; to: number; kind: 'ladder' | 'snake' }) {
  const start = getSquareCenterPercent(from)
  const end = getSquareCenterPercent(to)
  return (
    <line
      x1={`${start.leftPercent + 5}%`}
      y1={`${start.topPercent + 5}%`}
      x2={`${end.leftPercent + 5}%`}
      y2={`${end.topPercent + 5}%`}
      className={`board-connector board-connector--${kind}`}
    />
  )
}

export function Board({ positions }: BoardProps) {
  return (
    <div className="board">
      <div className="board-grid">
        {squares.map((square) => {
          const { row, col } = getSquarePosition(square)
          const isLadderStart = square in LADDERS
          const isSnakeStart = square in SNAKES
          const isDark = (row + col) % 2 === 1
          return (
            <div
              key={square}
              className={
                'board-square' +
                (isDark ? ' board-square--dark' : '') +
                (isLadderStart ? ' board-square--ladder' : '') +
                (isSnakeStart ? ' board-square--snake' : '')
              }
              style={{ gridRow: 10 - row, gridColumn: col + 1 }}
            >
              <span className="board-square__number">{square}</span>
            </div>
          )
        })}
      </div>

      <svg className="board-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
        {Object.entries(LADDERS).map(([from, to]) => (
          <Connector key={`ladder-${from}`} from={Number(from)} to={to} kind="ladder" />
        ))}
        {Object.entries(SNAKES).map(([from, to]) => (
          <Connector key={`snake-${from}`} from={Number(from)} to={to} kind="snake" />
        ))}
      </svg>

      <div className="board-pieces">
        <Piece player="human" square={positions.human} />
        <Piece player="computer" square={positions.computer} />
      </div>
    </div>
  )
}
