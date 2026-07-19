import { MultiplayerGame } from './MultiplayerGame'
import { MultiplayerLobby } from './MultiplayerLobby'
import { WaitingRoom } from './WaitingRoom'
import { useMultiplayerGame } from './useMultiplayerGame'

interface MultiplayerProps {
  onExit: () => void
}

export function Multiplayer({ onExit }: MultiplayerProps) {
  const { status, error, gamesList, game, myPlayerId, refreshGamesList, createGame, joinGame, startGame, roll, leaveToLobby } =
    useMultiplayerGame()

  if (!game || !myPlayerId) {
    return (
      <MultiplayerLobby
        status={status}
        error={error}
        gamesList={gamesList}
        onRefresh={refreshGamesList}
        onCreate={createGame}
        onJoin={joinGame}
        onBack={onExit}
      />
    )
  }

  if (game.status === 'waiting') {
    return <WaitingRoom game={game} myPlayerId={myPlayerId} onStart={startGame} onLeave={leaveToLobby} />
  }

  return <MultiplayerGame game={game} myPlayerId={myPlayerId} onRoll={roll} onLeaveToLobby={leaveToLobby} />
}
