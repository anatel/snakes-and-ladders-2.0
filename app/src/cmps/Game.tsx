import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Board } from './Board'
import { Dice } from './Dice'
import { useGame } from '../game/useGame'

const STATUS_TEXT: Record<'human' | 'computer', string> = {
  human: 'Your turn - roll the die',
  computer: "Computer's turn..."
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
        <p className="game-status">
          {state.phase === 'won' ? `${state.winner === 'human' ? 'You' : 'Computer'} won!` : STATUS_TEXT[state.currentPlayer]}
        </p>
      </header>

      <Board positions={state.positions} />

      <footer className="game-footer">
        <Dice value={state.lastRoll} isRolling={isRolling} canRoll={canRoll} onRoll={roll} />
        <button type="button" className="game-reset" onClick={handlePlayAgain}>
          Play again
        </button>
      </footer>
    </div>
  )
}
