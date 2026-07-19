import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Board } from './Board'
import { Dice } from './Dice'
import { useGame } from '../game/useGame'
import { LADDERS } from '../game/board'

const STATUS_TEXT: Record<'human' | 'computer', string> = {
  human: 'Your turn - roll the die',
  computer: "Computer's turn..."
}

function getStatusText(state: ReturnType<typeof useGame>['state']): string {
  if (state.phase === 'won') {
    return `${state.winner === 'human' ? 'You' : 'Computer'} won!`
  }
  if (state.phase === 'resolving-shortcut') {
    const who = state.currentPlayer === 'human' ? 'You' : 'Computer'
    const square = state.positions[state.currentPlayer]
    const isLadder = square in LADDERS
    return isLadder ? `${who} found a ladder!` : `${who} hit a snake!`
  }
  return STATUS_TEXT[state.currentPlayer]
}

export function Game() {
  const { state, isRolling, canRoll, roll, reset } = useGame()
  const announcedWinner = useRef<string | null>(null)

  useEffect(() => {
    if (state.phase !== 'won' || !state.winner) return
    if (announcedWinner.current === state.winner) return
    announcedWinner.current = state.winner

    if (state.winner === 'human') {
      toast.success('You won!', { description: 'You reached square 100 first.' })
    } else {
      toast('Computer won', { description: 'Better luck on the next roll.' })
    }
  }, [state.phase, state.winner])

  const handlePlayAgain = () => {
    announcedWinner.current = null
    reset()
  }

  return (
    <div className="game">
      <header className="game-header">
        <h1 className="game-title">Snakes and Ladders</h1>
        <p className="game-status">{getStatusText(state)}</p>
      </header>

      <Board
        pieces={[
          { id: 'human', colorIndex: 0, square: state.positions.human, label: 'human' },
          { id: 'computer', colorIndex: 1, square: state.positions.computer, label: 'computer' }
        ]}
      />

      <footer className="game-footer">
        <Dice value={state.lastRoll} isRolling={isRolling} canRoll={canRoll} onRoll={roll} />
        <button type="button" className="game-reset" onClick={handlePlayAgain}>
          Play again
        </button>
      </footer>
    </div>
  )
}
