import { randomUUID } from 'node:crypto'
import { BOARD_SIZE, getShortcut } from '../src/game/board'
import { rollDie } from '../src/game/gameLogic'
import {
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  SHORTCUT_PAUSE_MS,
  TURN_TIMEOUT_MS,
  type GameStateView,
  type GameSummary,
  type GameStatus,
  type TurnPhase,
  type WinReason
} from '../src/mp/protocol'

// Minimal shape we need from a live connection, so this module (and its
// tests) never have to depend on the `ws` package directly.
export interface Connection {
  send(data: string): void
}

interface Player {
  id: string
  token: string
  name: string
  colorIndex: number
  position: number
  isLeft: boolean
  socket: Connection | null
}

interface Game {
  id: string
  name: string
  status: GameStatus
  phase: TurnPhase
  players: Player[]
  currentPlayerIndex: number
  turnEndsAt: number | null
  turnTimer: ReturnType<typeof setTimeout> | null
  shortcutTimer: ReturnType<typeof setTimeout> | null
  lastRoll: number | null
  winnerId: string | null
  winReason: WinReason | null
}

export class DomainError extends Error {}

export interface StraightMoveOutcome {
  position: number
  won: boolean
  shortcutDestination: number | null
}

// Pure square-arithmetic for a single roll, factored out so it's directly
// unit-testable without going through session/turn machinery. Mirrors the
// three outcomes of app/src/game/gameLogic.ts's applyStraightMove, adapted
// to return a description of the outcome instead of a whole GameState.
export function computeStraightMove(position: number, roll: number): StraightMoveOutcome {
  const straightMove = position + roll

  if (straightMove > BOARD_SIZE) {
    // Overshoot: classic rule requires an exact roll to reach square 100.
    return { position, won: false, shortcutDestination: null }
  }
  if (straightMove === BOARD_SIZE) {
    return { position: BOARD_SIZE, won: true, shortcutDestination: null }
  }
  return { position: straightMove, won: false, shortcutDestination: getShortcut(straightMove) }
}

const games = new Map<string, Game>()

// Called after every state change so the caller (the WebSocket server) can
// re-serialize and broadcast. Set once at server startup; a no-op by default
// so this module works standalone in tests.
type ChangeListener = (gameId: string) => void
let notifyChange: ChangeListener = () => {}
export function onGameChange(listener: ChangeListener): void {
  notifyChange = listener
}

function activePlayers(game: Game): Player[] {
  return game.players.filter((p) => !p.isLeft)
}

function currentPlayer(game: Game): Player | null {
  return game.players[game.currentPlayerIndex] ?? null
}

function nextActiveIndex(game: Game, fromIndex: number): number {
  let next = fromIndex
  do {
    next = (next + 1) % game.players.length
  } while (game.players[next].isLeft)
  return next
}

function nextColorIndex(game: Game): number {
  const used = new Set(game.players.map((p) => p.colorIndex))
  for (let i = 0; i < MAX_PLAYERS; i++) {
    if (!used.has(i)) return i
  }
  return game.players.length
}

function requireGame(gameId: string): Game {
  const game = games.get(gameId)
  if (!game) throw new DomainError('Game not found')
  return game
}

function clearTurnTimer(game: Game): void {
  if (game.turnTimer) clearTimeout(game.turnTimer)
  game.turnTimer = null
}

function clearShortcutTimer(game: Game): void {
  if (game.shortcutTimer) clearTimeout(game.shortcutTimer)
  game.shortcutTimer = null
}

function finishGame(game: Game, winnerId: string | null, reason: WinReason): void {
  game.status = 'finished'
  game.winnerId = winnerId
  game.winReason = reason
  game.phase = 'awaiting-roll'
  game.turnEndsAt = null
  clearTurnTimer(game)
  clearShortcutTimer(game)
}

function startTurn(game: Game): void {
  clearTurnTimer(game)
  const player = currentPlayer(game)
  if (!player) return
  game.phase = 'awaiting-roll'
  game.turnEndsAt = Date.now() + TURN_TIMEOUT_MS
  game.turnTimer = setTimeout(() => handleTurnTimeout(game, player), TURN_TIMEOUT_MS)
}

// The timeout callback is scheduled once, at the moment a turn starts, but
// Node still delivers it asynchronously - a reconnect, another removal, or
// the game ending some other way can land in the same tick before this runs.
// Re-check that the game is still in progress, that it's still this exact
// player's turn, and that they haven't already been removed by some other
// path, before applying the removal. That makes "the timer already fired" and
// "the player already reconnected" mutually exclusive: whichever state
// change actually lands first wins, and a stale callback becomes a no-op
// instead of undoing it.
function handleTurnTimeout(game: Game, player: Player): void {
  if (game.status !== 'in-progress') return
  if (currentPlayer(game) !== player) return
  if (player.isLeft) return
  removePlayer(game, player)
}

function removePlayer(game: Game, player: Player): void {
  player.isLeft = true
  player.socket = null

  const remaining = activePlayers(game)
  if (remaining.length <= 1) {
    finishGame(game, remaining[0]?.id ?? null, 'last-player-standing')
  } else {
    game.currentPlayerIndex = nextActiveIndex(game, game.currentPlayerIndex)
    startTurn(game)
  }
  notifyChange(game.id)
}

function addPlayer(game: Game, name: string, connection: Connection): Player {
  const player: Player = {
    id: randomUUID(),
    token: randomUUID(),
    name,
    colorIndex: nextColorIndex(game),
    position: 0,
    isLeft: false,
    socket: connection
  }
  game.players.push(player)
  notifyChange(game.id)
  return player
}

export function listOpenGames(): GameSummary[] {
  return [...games.values()]
    .filter((game) => game.status === 'waiting')
    .map((game) => ({
      id: game.id,
      name: game.name,
      playerCount: game.players.length,
      maxPlayers: MAX_PLAYERS
    }))
}

export function createGame(
  gameName: string,
  playerName: string,
  connection: Connection
): { game: GameStateView; playerId: string; token: string } {
  const trimmedName = gameName.trim()
  const trimmedPlayer = playerName.trim()
  if (!trimmedName) throw new DomainError('Game name is required')
  if (!trimmedPlayer) throw new DomainError('Player name is required')

  const game: Game = {
    id: randomUUID(),
    name: trimmedName,
    status: 'waiting',
    phase: 'awaiting-roll',
    players: [],
    currentPlayerIndex: 0,
    turnEndsAt: null,
    turnTimer: null,
    shortcutTimer: null,
    lastRoll: null,
    winnerId: null,
    winReason: null
  }
  games.set(game.id, game)
  const player = addPlayer(game, trimmedPlayer, connection)
  return { game: serializeGame(game), playerId: player.id, token: player.token }
}

export function joinGame(
  gameId: string,
  playerName: string,
  connection: Connection
): { game: GameStateView; playerId: string; token: string } {
  const game = requireGame(gameId)
  const trimmedPlayer = playerName.trim()
  if (!trimmedPlayer) throw new DomainError('Player name is required')
  if (game.status !== 'waiting') throw new DomainError('This game has already started')
  if (game.players.length >= MAX_PLAYERS) throw new DomainError('This game is full')

  const player = addPlayer(game, trimmedPlayer, connection)
  return { game: serializeGame(game), playerId: player.id, token: player.token }
}

export function startGame(gameId: string, playerId: string): GameStateView {
  const game = requireGame(gameId)
  if (game.status !== 'waiting') throw new DomainError('This game has already started')
  if (game.players[0]?.id !== playerId) throw new DomainError('Only the game creator can start the game')
  if (game.players.length < MIN_PLAYERS_TO_START) {
    throw new DomainError(`Need at least ${MIN_PLAYERS_TO_START} players to start`)
  }

  game.status = 'in-progress'
  startTurn(game)
  notifyChange(game.id)
  return serializeGame(game)
}

export function applyRoll(gameId: string, playerId: string): GameStateView {
  const game = requireGame(gameId)
  if (game.status !== 'in-progress') throw new DomainError('Game is not in progress')
  if (game.phase !== 'awaiting-roll') throw new DomainError('Already resolving the previous roll')
  const player = currentPlayer(game)
  if (!player || player.id !== playerId) throw new DomainError('Not your turn')

  clearTurnTimer(game)
  game.turnEndsAt = null

  const roll = rollDie()
  game.lastRoll = roll
  const outcome = computeStraightMove(player.position, roll)
  player.position = outcome.position

  if (outcome.won) {
    finishGame(game, player.id, 'reached-100')
    notifyChange(game.id)
    return serializeGame(game)
  }

  const { shortcutDestination } = outcome
  if (shortcutDestination === null) {
    game.currentPlayerIndex = nextActiveIndex(game, game.currentPlayerIndex)
    startTurn(game)
    notifyChange(game.id)
    return serializeGame(game)
  }

  // Landed on a snake head or ladder base: hold here in 'resolving-shortcut'
  // so clients can animate the landing before the slide, mirroring the
  // single-player two-phase turn (see app/src/game/useGame.ts). No turn
  // timer runs during this phase - it's an automatic resolution, not a wait
  // on player input.
  game.phase = 'resolving-shortcut'
  notifyChange(game.id)
  game.shortcutTimer = setTimeout(() => resolveShortcut(game, player, shortcutDestination), SHORTCUT_PAUSE_MS)
  return serializeGame(game)
}

function resolveShortcut(game: Game, player: Player, destination: number): void {
  if (game.status !== 'in-progress') return
  player.position = destination

  if (destination === BOARD_SIZE) {
    finishGame(game, player.id, 'reached-100')
  } else {
    game.currentPlayerIndex = nextActiveIndex(game, game.currentPlayerIndex)
    startTurn(game)
  }
  notifyChange(game.id)
}

export function handleReconnect(
  gameId: string,
  playerId: string,
  token: string,
  connection: Connection
): GameStateView {
  const game = requireGame(gameId)
  const player = game.players.find((p) => p.id === playerId)
  if (!player || player.token !== token) throw new DomainError('Invalid reconnect token')
  if (player.isLeft) throw new DomainError('You were removed from this game and cannot rejoin')

  player.socket = connection
  // Deliberately leaves turnTimer/turnEndsAt/shortcutTimer untouched:
  // reconnecting resumes whatever time is left on the current turn rather
  // than granting a fresh minute. If a timeout already fired for this player
  // before this call, `player.isLeft` above already caught that.
  notifyChange(game.id)
  return serializeGame(game)
}

export function handleDisconnect(gameId: string, playerId: string): void {
  const game = games.get(gameId)
  if (!game) return
  const player = game.players.find((p) => p.id === playerId)
  if (!player) return

  if (game.status === 'waiting') {
    // No seat worth preserving before the game has started - free the slot.
    game.players = game.players.filter((p) => p.id !== playerId)
    if (game.players.length === 0) {
      games.delete(gameId)
      return
    }
    notifyChange(game.id)
    return
  }

  player.socket = null
  notifyChange(game.id)
}

export function getGame(gameId: string): GameStateView | undefined {
  const game = games.get(gameId)
  return game ? serializeGame(game) : undefined
}

export function getConnections(gameId: string): Connection[] {
  const game = games.get(gameId)
  if (!game) return []
  return game.players.map((p) => p.socket).filter((socket): socket is Connection => socket !== null)
}

function serializeGame(game: Game): GameStateView {
  return {
    id: game.id,
    name: game.name,
    status: game.status,
    phase: game.phase,
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      colorIndex: p.colorIndex,
      square: p.position,
      isLeft: p.isLeft,
      isConnected: p.socket !== null
    })),
    currentPlayerId: game.status === 'in-progress' ? currentPlayer(game)?.id ?? null : null,
    turnEndsAt: game.turnEndsAt,
    lastRoll: game.lastRoll,
    winnerId: game.winnerId,
    winReason: game.winReason
  }
}

export function __resetForTests(): void {
  for (const game of games.values()) {
    clearTurnTimer(game)
    clearShortcutTimer(game)
  }
  games.clear()
  notifyChange = () => {}
}
