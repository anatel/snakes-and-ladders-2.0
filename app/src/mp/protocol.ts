// Shared client/server contract for online multiplayer, per
// .plan/002-2026-07-17-multiplayer.md. Imported directly by the browser
// client (app/src) and the Node WebSocket server (app/server) so both
// sides of the wire stay in sync from one source of truth.

export const MAX_PLAYERS = 4
export const MIN_PLAYERS_TO_START = 2
export const TURN_TIMEOUT_MS = 60_000

export const SHORTCUT_PAUSE_MS = 550

export type GameStatus = 'waiting' | 'in-progress' | 'finished'
export type TurnPhase = 'awaiting-roll' | 'resolving-shortcut'
export type WinReason = 'reached-100' | 'last-player-standing'

export interface PlayerView {
  id: string
  name: string
  colorIndex: number
  square: number
  isLeft: boolean
  isConnected: boolean
}

export interface GameSummary {
  id: string
  name: string
  playerCount: number
  maxPlayers: number
}

export interface GameStateView {
  id: string
  name: string
  status: GameStatus
  phase: TurnPhase
  players: PlayerView[]
  currentPlayerId: string | null
  turnEndsAt: number | null
  lastRoll: number | null
  winnerId: string | null
  winReason: WinReason | null
}

export type ClientMessage =
  | { type: 'list-games' }
  | { type: 'create-game'; gameName: string; playerName: string }
  | { type: 'join-game'; gameId: string; playerName: string }
  | { type: 'reconnect'; gameId: string; playerId: string; token: string }
  | { type: 'start-game'; gameId: string; playerId: string }
  | { type: 'roll'; gameId: string; playerId: string }

export type ServerMessage =
  | { type: 'games-list'; games: GameSummary[] }
  | { type: 'joined'; gameId: string; playerId: string; token: string; game: GameStateView }
  | { type: 'game-state'; game: GameStateView }
  | { type: 'error'; message: string }
