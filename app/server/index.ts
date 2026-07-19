import { WebSocketServer, type WebSocket } from 'ws'
import {
  DomainError,
  applyRoll,
  createGame,
  getConnections,
  getGame,
  handleDisconnect,
  handleReconnect,
  joinGame,
  leaveGame,
  listOpenGames,
  onGameChange,
  postChatMessage,
  startGame
} from './gameStore'
import type { ClientMessage, ServerMessage } from '../src/mp/protocol'

const PORT = Number(process.env.PORT) || 8080

const wss = new WebSocketServer({ port: PORT })

interface Identity {
  gameId: string
  playerId: string
}

const identities = new WeakMap<WebSocket, Identity>()

function send(socket: WebSocket, message: ServerMessage): void {
  socket.send(JSON.stringify(message))
}

function sendError(socket: WebSocket, message: string): void {
  send(socket, { type: 'error', message })
}

// Confirms the socket sending a start-game/roll message is the same
// connection that create/join/reconnect authenticated as this player - the
// client-supplied gameId/playerId in the message body is not trusted on its
// own, since a socket could otherwise act on a game/player it was never
// admitted to.
function requireOwnIdentity(socket: WebSocket, gameId: string, playerId: string): boolean {
  const identity = identities.get(socket)
  if (!identity || identity.gameId !== gameId || identity.playerId !== playerId) {
    sendError(socket, 'Not authenticated for this game/player')
    return false
  }
  return true
}

onGameChange((gameId) => {
  const game = getGame(gameId)
  if (!game) return
  const payload = JSON.stringify({ type: 'game-state', game } satisfies ServerMessage)
  for (const connection of getConnections(gameId)) {
    connection.send(payload)
  }
})

wss.on('connection', (socket) => {
  socket.on('message', (raw) => {
    let message: ClientMessage
    try {
      message = JSON.parse(raw.toString())
    } catch {
      sendError(socket, 'Malformed message')
      return
    }

    try {
      switch (message.type) {
        case 'list-games': {
          send(socket, { type: 'games-list', games: listOpenGames() })
          break
        }
        case 'create-game': {
          const { game, playerId, token } = createGame(message.gameName, message.playerName, socket)
          identities.set(socket, { gameId: game.id, playerId })
          send(socket, { type: 'joined', gameId: game.id, playerId, token, game })
          break
        }
        case 'join-game': {
          const { game, playerId, token } = joinGame(message.gameId, message.playerName, socket)
          identities.set(socket, { gameId: game.id, playerId })
          send(socket, { type: 'joined', gameId: game.id, playerId, token, game })
          break
        }
        case 'reconnect': {
          const game = handleReconnect(message.gameId, message.playerId, message.token, socket)
          identities.set(socket, { gameId: message.gameId, playerId: message.playerId })
          send(socket, {
            type: 'joined',
            gameId: message.gameId,
            playerId: message.playerId,
            token: message.token,
            game
          })
          break
        }
        case 'start-game': {
          if (!requireOwnIdentity(socket, message.gameId, message.playerId)) break
          startGame(message.gameId, message.playerId)
          break
        }
        case 'roll': {
          if (!requireOwnIdentity(socket, message.gameId, message.playerId)) break
          applyRoll(message.gameId, message.playerId)
          break
        }
        case 'send-chat-message': {
          if (!requireOwnIdentity(socket, message.gameId, message.playerId)) break
          postChatMessage(message.gameId, message.playerId, message.text)
          break
        }
        case 'leave-game': {
          if (!requireOwnIdentity(socket, message.gameId, message.playerId)) break
          leaveGame(message.gameId, message.playerId)
          identities.delete(socket)
          break
        }
      }
    } catch (err) {
      if (err instanceof DomainError) {
        sendError(socket, err.message)
      } else {
        console.error('Unexpected multiplayer error', err)
        sendError(socket, 'Something went wrong')
      }
    }
  })

  socket.on('close', () => {
    const identity = identities.get(socket)
    if (!identity) return
    handleDisconnect(identity.gameId, identity.playerId)
    identities.delete(socket)
  })
})

console.log(`Multiplayer WebSocket server listening on ws://localhost:${PORT}`)
