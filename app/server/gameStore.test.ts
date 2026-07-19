import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TURN_TIMEOUT_MS } from '../src/mp/protocol'
import {
  DomainError,
  __resetForTests,
  applyRoll,
  computeStraightMove,
  createGame,
  getGame,
  handleDisconnect,
  handleReconnect,
  joinGame,
  listOpenGames,
  startGame,
  type Connection
} from './gameStore'

function fakeConnection(): Connection {
  return { send: vi.fn() }
}

// rollDie() is Math.floor(Math.random() * 6) + 1. Queue up the exact die
// values a test needs, in the order rollDie() will be called.
function queueRolls(...values: number[]): void {
  const queue = [...values]
  vi.spyOn(Math, 'random').mockImplementation(() => {
    const value = queue.shift()
    if (value === undefined) throw new Error('queueRolls exhausted - test rolled more times than expected')
    return (value - 1) / 6
  })
}

function setUpTwoPlayerGame() {
  const created = createGame('Friday game', 'Alice', fakeConnection())
  const joined = joinGame(created.game.id, 'Bob', fakeConnection())
  const started = startGame(created.game.id, created.playerId)
  return {
    gameId: created.game.id,
    aId: created.playerId,
    aToken: created.token,
    bId: joined.playerId,
    bToken: joined.token,
    started
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  __resetForTests()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('computeStraightMove', () => {
  it('moves forward by the roll amount on a plain square', () => {
    expect(computeStraightMove(10, 4)).toEqual({ position: 14, won: false, shortcutDestination: null })
  })

  it('stays in place when the roll would overshoot square 100', () => {
    expect(computeStraightMove(98, 5)).toEqual({ position: 98, won: false, shortcutDestination: null })
  })

  it('wins when landing exactly on square 100', () => {
    expect(computeStraightMove(94, 6)).toEqual({ position: 100, won: true, shortcutDestination: null })
  })

  it('reports the shortcut destination when landing on a ladder base', () => {
    // square 1 is a ladder base that climbs to square 38
    expect(computeStraightMove(0, 1)).toEqual({ position: 1, won: false, shortcutDestination: 38 })
  })

  it('reports the shortcut destination when landing on a snake head', () => {
    // square 16 is a snake head that drops to square 6
    expect(computeStraightMove(10, 6)).toEqual({ position: 16, won: false, shortcutDestination: 6 })
  })
})

describe('createGame / joinGame / startGame', () => {
  it('rejects a blank game name or player name', () => {
    expect(() => createGame('  ', 'Alice', fakeConnection())).toThrow(DomainError)
    expect(() => createGame('Game', '  ', fakeConnection())).toThrow(DomainError)
  })

  it('rejects joining a game that already started', () => {
    const { gameId } = setUpTwoPlayerGame()
    expect(() => joinGame(gameId, 'Carol', fakeConnection())).toThrow('already started')
  })

  it('rejects joining a full game', () => {
    const created = createGame('Full house', 'P1', fakeConnection())
    joinGame(created.game.id, 'P2', fakeConnection())
    joinGame(created.game.id, 'P3', fakeConnection())
    joinGame(created.game.id, 'P4', fakeConnection())
    expect(() => joinGame(created.game.id, 'P5', fakeConnection())).toThrow('full')
  })

  it('only lets the creator (first joiner) start the game', () => {
    const created = createGame('Game', 'Alice', fakeConnection())
    const joined = joinGame(created.game.id, 'Bob', fakeConnection())
    expect(() => startGame(created.game.id, joined.playerId)).toThrow('creator')
  })

  it('requires at least 2 players to start', () => {
    const created = createGame('Solo', 'Alice', fakeConnection())
    expect(() => startGame(created.game.id, created.playerId)).toThrow('at least 2')
  })

  it('starts the turn timer for the first joiner once the game starts', () => {
    const { started, aId } = setUpTwoPlayerGame()
    expect(started.status).toBe('in-progress')
    expect(started.currentPlayerId).toBe(aId)
    expect(started.turnEndsAt).toBe(Date.now() + TURN_TIMEOUT_MS)
  })
})

describe('turn timeout', () => {
  it('removes a player who never rolls, passing the turn to the next active player', () => {
    const created = createGame('Trio', 'Alice', fakeConnection())
    const bob = joinGame(created.game.id, 'Bob', fakeConnection())
    joinGame(created.game.id, 'Carol', fakeConnection())
    startGame(created.game.id, created.playerId)

    vi.advanceTimersByTime(TURN_TIMEOUT_MS)

    const game = getGame(created.game.id)!
    expect(game.status).toBe('in-progress')
    expect(game.players.find((p) => p.id === created.playerId)?.isLeft).toBe(true)
    expect(game.currentPlayerId).toBe(bob.playerId)
  })

  it('ends the game in favor of the last remaining player', () => {
    const { gameId, bId } = setUpTwoPlayerGame()

    vi.advanceTimersByTime(TURN_TIMEOUT_MS)

    const game = getGame(gameId)!
    expect(game.status).toBe('finished')
    expect(game.winnerId).toBe(bId)
    expect(game.winReason).toBe('last-player-standing')
  })
})

describe('reconnect', () => {
  it('lets a player resume their seat before the turn timer expires, without resetting the countdown', () => {
    const { gameId, aId, aToken, started } = setUpTwoPlayerGame()

    handleDisconnect(gameId, aId)
    vi.advanceTimersByTime(TURN_TIMEOUT_MS - 1000)
    const game = handleReconnect(gameId, aId, aToken, fakeConnection())

    expect(game.players.find((p) => p.id === aId)?.isLeft).toBe(false)
    expect(game.players.find((p) => p.id === aId)?.isConnected).toBe(true)
    expect(game.turnEndsAt).toBe(started.turnEndsAt)
  })

  it('rejects reconnecting once the turn timer has already removed the player', () => {
    const { gameId, aId, aToken } = setUpTwoPlayerGame()

    vi.advanceTimersByTime(TURN_TIMEOUT_MS)

    expect(() => handleReconnect(gameId, aId, aToken, fakeConnection())).toThrow('removed')
  })

  it('rejects an invalid token', () => {
    const { gameId, aId } = setUpTwoPlayerGame()
    expect(() => handleReconnect(gameId, aId, 'not-the-real-token', fakeConnection())).toThrow(
      'Invalid reconnect token'
    )
  })
})

describe('applyRoll', () => {
  it('rejects a roll from a player whose turn it is not', () => {
    const { gameId, bId } = setUpTwoPlayerGame()
    expect(() => applyRoll(gameId, bId)).toThrow('Not your turn')
  })

  it('moves the player and passes the turn on a plain roll', () => {
    const { gameId, aId, bId } = setUpTwoPlayerGame()
    queueRolls(3)

    const game = applyRoll(gameId, aId)

    expect(game.players.find((p) => p.id === aId)?.square).toBe(3)
    expect(game.currentPlayerId).toBe(bId)
    expect(game.phase).toBe('awaiting-roll')
  })

  it('holds the player in resolving-shortcut, then slides them and passes the turn', () => {
    const { gameId, aId, bId } = setUpTwoPlayerGame()
    // square 1 is a ladder base that climbs to square 38
    queueRolls(1)

    const mid = applyRoll(gameId, aId)
    expect(mid.phase).toBe('resolving-shortcut')
    expect(mid.players.find((p) => p.id === aId)?.square).toBe(1)
    expect(mid.currentPlayerId).toBe(aId)

    vi.runOnlyPendingTimers()

    const resolved = getGame(gameId)!
    expect(resolved.phase).toBe('awaiting-roll')
    expect(resolved.players.find((p) => p.id === aId)?.square).toBe(38)
    expect(resolved.currentPlayerId).toBe(bId)
  })

  it('does not schedule a turn-timeout removal while resolving a shortcut', () => {
    const { gameId, aId } = setUpTwoPlayerGame()
    queueRolls(1)
    applyRoll(gameId, aId)

    // Advancing well past the normal turn timeout should not remove anyone -
    // no turn timer runs during the automatic shortcut animation.
    vi.advanceTimersByTime(TURN_TIMEOUT_MS * 2)

    const game = getGame(gameId)!
    expect(game.players.find((p) => p.id === aId)?.isLeft).toBe(false)
  })
})

describe('waiting-room disconnects', () => {
  it('frees the slot when a player disconnects before the game starts', () => {
    const created = createGame('Game', 'Alice', fakeConnection())
    joinGame(created.game.id, 'Bob', fakeConnection())

    handleDisconnect(created.game.id, created.playerId)

    const game = getGame(created.game.id)!
    expect(game.players.map((p) => p.name)).toEqual(['Bob'])
    expect(listOpenGames().find((g) => g.id === created.game.id)?.playerCount).toBe(1)
  })

  it('deletes the game once every waiting player has disconnected', () => {
    const created = createGame('Game', 'Alice', fakeConnection())
    handleDisconnect(created.game.id, created.playerId)
    expect(getGame(created.game.id)).toBeUndefined()
  })

  it('reuses a freed color slot for the next joiner instead of colliding', () => {
    const created = createGame('Game', 'Alice', fakeConnection()) // colorIndex 0
    const bob = joinGame(created.game.id, 'Bob', fakeConnection()) // colorIndex 1
    handleDisconnect(created.game.id, created.playerId) // frees colorIndex 0

    const carol = joinGame(created.game.id, 'Carol', fakeConnection())

    const game = getGame(created.game.id)!
    const bobColor = game.players.find((p) => p.id === bob.playerId)?.colorIndex
    const carolColor = game.players.find((p) => p.id === carol.playerId)?.colorIndex
    expect(carolColor).toBe(0)
    expect(carolColor).not.toBe(bobColor)
  })
})
