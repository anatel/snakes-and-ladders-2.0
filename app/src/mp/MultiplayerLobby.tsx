import { useState } from 'react'
import type { GameSummary } from './protocol'
import type { ConnectionStatus } from './useMultiplayerGame'

interface MultiplayerLobbyProps {
  status: ConnectionStatus
  error: string | null
  gamesList: GameSummary[]
  onRefresh: () => void
  onCreate: (gameName: string, playerName: string) => void
  onJoin: (gameId: string, playerName: string) => void
  onBack: () => void
}

export function MultiplayerLobby({
  status,
  error,
  gamesList,
  onRefresh,
  onCreate,
  onJoin,
  onBack
}: MultiplayerLobbyProps) {
  const [playerName, setPlayerName] = useState('')
  const [gameName, setGameName] = useState('')

  const canAct = status === 'open' && playerName.trim().length > 0

  return (
    <div className="mp-lobby">
      <header className="mp-lobby-header">
        <h1 className="game-title">Online Multiplayer</h1>
        <button type="button" className="mp-link-button" onClick={onBack}>
          Back
        </button>
      </header>

      <label className="mp-field">
        Your name
        <input
          value={playerName}
          onChange={(event) => setPlayerName(event.target.value)}
          maxLength={20}
          placeholder="Enter your name"
        />
      </label>

      <section className="mp-section">
        <h2>Create a game</h2>
        <div className="mp-create-row">
          <input
            value={gameName}
            onChange={(event) => setGameName(event.target.value)}
            maxLength={30}
            placeholder="Name your game"
          />
          <button
            type="button"
            disabled={!canAct || gameName.trim().length === 0}
            onClick={() => onCreate(gameName.trim(), playerName.trim())}
          >
            Create
          </button>
        </div>
      </section>

      <section className="mp-section">
        <div className="mp-section-header">
          <h2>Join an open game</h2>
          <button type="button" className="mp-link-button" onClick={onRefresh} disabled={status !== 'open'}>
            Refresh
          </button>
        </div>
        {error && <p className="mp-error">{error}</p>}
        {gamesList.length === 0 ? (
          <p className="mp-empty">No open games right now - create one!</p>
        ) : (
          <ul className="mp-games-list">
            {gamesList.map((game) => (
              <li key={game.id} className="mp-game-row">
                <span className="mp-game-name">{game.name}</span>
                <span className="mp-game-count">
                  {game.playerCount}/{game.maxPlayers} players
                </span>
                <button
                  type="button"
                  disabled={!canAct || game.playerCount >= game.maxPlayers}
                  onClick={() => onJoin(game.id, playerName.trim())}
                >
                  Join
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
