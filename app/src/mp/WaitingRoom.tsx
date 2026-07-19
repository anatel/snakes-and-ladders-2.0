import { Chat } from './Chat'
import { MIN_PLAYERS_TO_START, type GameStateView } from './protocol'

interface WaitingRoomProps {
  game: GameStateView
  myPlayerId: string
  onStart: () => void
  onLeave: () => void
  onSendChatMessage: (text: string) => void
}

export function WaitingRoom({ game, myPlayerId, onStart, onLeave, onSendChatMessage }: WaitingRoomProps) {
  const isCreator = game.players[0]?.id === myPlayerId
  const canStart = isCreator && game.players.length >= MIN_PLAYERS_TO_START

  return (
    <div className="mp-layout">
      <div className="mp-waiting-room">
        <h1 className="game-title">{game.name}</h1>
        <p className="game-status">Waiting for players ({game.players.length}/4)</p>

        <ul className="mp-player-list">
          {game.players.map((player) => (
            <li key={player.id} className="mp-player">
              <span className={`mp-player-dot piece--${player.colorIndex}`} />
              <span className="mp-player-name">
                {player.name}
                {player.id === myPlayerId ? ' (you)' : ''}
              </span>
            </li>
          ))}
        </ul>

        {isCreator ? (
          <button type="button" className="game-reset" disabled={!canStart} onClick={onStart}>
            {canStart ? 'Start game' : `Need at least ${MIN_PLAYERS_TO_START} players`}
          </button>
        ) : (
          <p className="mp-empty">Waiting for the host to start the game...</p>
        )}

        <button type="button" className="mp-link-button" onClick={onLeave}>
          Back to lobby
        </button>
      </div>

      <Chat messages={game.chatMessages} myPlayerId={myPlayerId} canSend onSend={onSendChatMessage} />
    </div>
  )
}
