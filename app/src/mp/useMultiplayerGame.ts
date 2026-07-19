import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClientMessage, GameStateView, GameSummary, ServerMessage } from './protocol'

const SESSION_KEY = 'sl-mp-session'

function serverUrl(): string {
  const host = window.location.hostname || 'localhost'
  return `ws://${host}:8080`
}

interface StoredSession {
  gameId: string
  playerId: string
  token: string
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    return null
  }
}

function writeStoredSession(session: StoredSession | null): void {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } else {
    localStorage.removeItem(SESSION_KEY)
  }
}

function gameIdFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/game\/([^/]+)$/)
  return match ? match[1] : null
}

// Gives a game a real, reloadable URL so "close the tab and reopen it" is an
// actual navigation, not just an in-memory app state - the reconnect flow
// below depends on the URL surviving a reload.
function setUrlForGame(gameId: string | null): void {
  const path = gameId ? `/game/${gameId}` : '/'
  if (window.location.pathname !== path) {
    window.history.pushState(null, '', path)
  }
}

export type ConnectionStatus = 'connecting' | 'open' | 'closed'

export function useMultiplayerGame() {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [gamesList, setGamesList] = useState<GameSummary[]>([])
  const [game, setGame] = useState<GameStateView | null>(null)
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const hasJoinedRef = useRef(false)

  const sendMessage = useCallback((message: ClientMessage) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify(message))
  }, [])

  useEffect(() => {
    const socket = new WebSocket(serverUrl())
    socketRef.current = socket

    socket.onopen = () => {
      setStatus('open')
      const stored = readStoredSession()
      const urlGameId = gameIdFromUrl()
      if (stored && (!urlGameId || urlGameId === stored.gameId)) {
        socket.send(
          JSON.stringify({
            type: 'reconnect',
            gameId: stored.gameId,
            playerId: stored.playerId,
            token: stored.token
          } satisfies ClientMessage)
        )
      } else {
        socket.send(JSON.stringify({ type: 'list-games' } satisfies ClientMessage))
      }
    }

    socket.onclose = () => setStatus('closed')

    socket.onmessage = (event) => {
      const message: ServerMessage = JSON.parse(event.data)
      switch (message.type) {
        case 'games-list': {
          setGamesList(message.games)
          break
        }
        case 'joined': {
          hasJoinedRef.current = true
          setMyPlayerId(message.playerId)
          setGame(message.game)
          setError(null)
          writeStoredSession({ gameId: message.gameId, playerId: message.playerId, token: message.token })
          setUrlForGame(message.gameId)
          break
        }
        case 'game-state': {
          setGame(message.game)
          break
        }
        case 'error': {
          setError(message.message)
          // Only a reconnect attempt can fail before we've ever joined. If
          // that happens the stored session is dead (token invalid, or the
          // player was already removed) - drop it so the next load goes to
          // the lobby instead of retrying a reconnect that will fail forever.
          if (!hasJoinedRef.current) {
            writeStoredSession(null)
            setUrlForGame(null)
          }
          break
        }
      }
    }

    return () => {
      socket.close()
      socketRef.current = null
    }
  }, [])

  const refreshGamesList = useCallback(() => sendMessage({ type: 'list-games' }), [sendMessage])

  const createGame = useCallback(
    (gameName: string, playerName: string) => sendMessage({ type: 'create-game', gameName, playerName }),
    [sendMessage]
  )

  const joinGame = useCallback(
    (gameId: string, playerName: string) => sendMessage({ type: 'join-game', gameId, playerName }),
    [sendMessage]
  )

  const startGame = useCallback(() => {
    if (!game || !myPlayerId) return
    sendMessage({ type: 'start-game', gameId: game.id, playerId: myPlayerId })
  }, [sendMessage, game, myPlayerId])

  const roll = useCallback(() => {
    if (!game || !myPlayerId) return
    sendMessage({ type: 'roll', gameId: game.id, playerId: myPlayerId })
  }, [sendMessage, game, myPlayerId])

  const leaveToLobby = useCallback(() => {
    writeStoredSession(null)
    setUrlForGame(null)
    setGame(null)
    setMyPlayerId(null)
    hasJoinedRef.current = false
    refreshGamesList()
  }, [refreshGamesList])

  return {
    status,
    error,
    gamesList,
    game,
    myPlayerId,
    refreshGamesList,
    createGame,
    joinGame,
    startGame,
    roll,
    leaveToLobby
  }
}
