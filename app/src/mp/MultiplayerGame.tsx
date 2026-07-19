import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Board } from '../cmps/Board'
import { Dice } from '../cmps/Dice'
import { LADDERS } from '../game/board'
import { playDiceRollSound, playLadderSound, playSnakeSound, playWinSound } from '../game/sounds'
import type { GameStateView } from './protocol'

const ROLL_ANIMATION_MS = 600
const CLOCK_TICK_MS = 250

interface MultiplayerGameProps {
  game: GameStateView
  myPlayerId: string
  onRoll: () => void
  onLeaveToLobby: () => void
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function MultiplayerGame({ game, myPlayerId, onRoll, onLeaveToLobby }: MultiplayerGameProps) {
  const [isRolling, setIsRolling] = useState(false)
  const announcedShortcutKeyRef = useRef<string | null>(null)
  const announcedFinishedGameIdRef = useRef<string | null>(null)
  const now = useNow(CLOCK_TICK_MS)

  const currentPlayer = game.players.find((p) => p.id === game.currentPlayerId) ?? null
  const isMyTurn = game.status === 'in-progress' && game.currentPlayerId === myPlayerId
  const canRoll = isMyTurn && game.phase === 'awaiting-roll' && !isRolling

  const handleRoll = () => {
    setIsRolling(true)
    playDiceRollSound()
    onRoll()
    setTimeout(() => setIsRolling(false), ROLL_ANIMATION_MS)
  }

  // Play the ladder/snake sound once per shortcut resolution. Keyed by
  // player+square (not just phase) so it can't double-fire across re-renders
  // while the server's SHORTCUT_PAUSE_MS timer is pending.
  useEffect(() => {
    if (game.phase !== 'resolving-shortcut' || !currentPlayer) return
    const key = `${currentPlayer.id}-${currentPlayer.square}`
    if (announcedShortcutKeyRef.current === key) return
    announcedShortcutKeyRef.current = key
    if (currentPlayer.square in LADDERS) playLadderSound()
    else playSnakeSound()
  }, [game.phase, currentPlayer])

  useEffect(() => {
    if (game.status !== 'finished' || announcedFinishedGameIdRef.current === game.id) return
    announcedFinishedGameIdRef.current = game.id
    playWinSound()

    const winner = game.players.find((p) => p.id === game.winnerId)
    const winnerName = winner?.name ?? 'Someone'
    const reasonText =
      game.winReason === 'reached-100'
        ? `${game.winnerId === myPlayerId ? 'You' : winnerName} reached square 100 first.`
        : `${game.winnerId === myPlayerId ? "You're" : `${winnerName} is`} the last player standing.`

    if (game.winnerId === myPlayerId) {
      toast.success('You won!', { description: reasonText })
    } else {
      toast(`${winnerName} won`, { description: reasonText })
    }
  }, [game.status, game.winnerId, game.winReason, game.id, game.players, myPlayerId])

  const secondsLeft = game.turnEndsAt !== null ? Math.max(0, Math.ceil((game.turnEndsAt - now) / 1000)) : null

  const statusText = (() => {
    if (game.status === 'finished') {
      const winner = game.players.find((p) => p.id === game.winnerId)
      return game.winnerId === myPlayerId ? 'You won!' : `${winner?.name ?? 'A player'} won!`
    }
    if (game.phase === 'resolving-shortcut' && currentPlayer) {
      const who = currentPlayer.id === myPlayerId ? 'You' : currentPlayer.name
      return currentPlayer.square in LADDERS ? `${who} found a ladder!` : `${who} hit a snake!`
    }
    if (isMyTurn) return 'Your turn - roll the die'
    return currentPlayer ? `${currentPlayer.name}'s turn...` : ''
  })()

  return (
    <div className="game">
      <header className="game-header">
        <h1 className="game-title">{game.name}</h1>
        <p className="game-status">{statusText}</p>
        {secondsLeft !== null && (
          <p className="mp-turn-timer">
            {currentPlayer?.id === myPlayerId ? 'Your' : `${currentPlayer?.name ?? ''}'s`} time left: {secondsLeft}s
          </p>
        )}
      </header>

      <Board
        pieces={game.players
          .filter((player) => !player.isLeft)
          .map((player) => ({
            id: player.id,
            colorIndex: player.colorIndex,
            square: player.square,
            label: player.name
          }))}
      />

      <ul className="mp-player-list">
        {game.players.map((player) => (
          <li
            key={player.id}
            className={'mp-player' + (player.id === game.currentPlayerId ? ' mp-player--active' : '')}
          >
            <span className={`mp-player-dot piece--${player.colorIndex}`} />
            <span className="mp-player-name">
              {player.name}
              {player.id === myPlayerId ? ' (you)' : ''}
            </span>
            {player.isLeft && <span className="mp-player-tag">left</span>}
            {!player.isLeft && !player.isConnected && <span className="mp-player-tag">reconnecting...</span>}
          </li>
        ))}
      </ul>

      <footer className="game-footer">
        {game.status === 'in-progress' ? (
          <Dice value={game.lastRoll} isRolling={isRolling} canRoll={canRoll} onRoll={handleRoll} />
        ) : (
          <button type="button" className="game-reset" onClick={onLeaveToLobby}>
            Back to lobby
          </button>
        )}
      </footer>
    </div>
  )
}
