import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_CHAT_HISTORY, MAX_CHAT_MESSAGE_LENGTH, TURN_TIMEOUT_MS } from '../src/mp/protocol'
import {
  DomainError,
  __resetForTests,
  applyRoll,
  computeStraightMove,
  createGame,
  getConnections,
  getGame,
  handleDisconnect,
  handleReconnect,
  joinGame,
  leaveGame,
  listOpenGames,
  postChatMessage,
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

  it('posts a system chat message announcing each player who joins, including the creator', () => {
    const created = createGame('Game', 'Alice', fakeConnection())
    const bob = joinGame(created.game.id, 'Bob', fakeConnection())

    expect(bob.game.chatMessages).toContainEqual(
      expect.objectContaining({
        kind: 'system',
        event: 'joined',
        playerId: created.playerId,
        text: 'Alice joined the game.'
      })
    )
    expect(bob.game.chatMessages).toContainEqual(
      expect.objectContaining({ kind: 'system', event: 'joined', playerId: bob.playerId, text: 'Bob joined the game.' })
    )
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

  it('posts a system chat message announcing the timed-out player left', () => {
    const created = createGame('Game', 'Alice', fakeConnection())
    joinGame(created.game.id, 'Bob', fakeConnection())
    startGame(created.game.id, created.playerId)

    vi.advanceTimersByTime(TURN_TIMEOUT_MS)

    const game = getGame(created.game.id)!
    expect(game.chatMessages).toContainEqual(
      expect.objectContaining({ kind: 'system', event: 'left', playerId: created.playerId, text: 'Alice left the game.' })
    )
  })

  it('keeps the timed-out player connected as a spectator instead of cutting off their broadcasts', () => {
    // If their connection were dropped here, their own client would never
    // receive the game-state update telling it they were removed - it'd
    // just go stale with no way to show "you left" or play a sound for it.
    const { gameId, aId } = setUpTwoPlayerGame()

    vi.advanceTimersByTime(TURN_TIMEOUT_MS)

    const connections = getConnections(gameId)
    expect(connections).toHaveLength(2)
  })
})

describe('leaveGame', () => {
  it('removes the current player immediately, without waiting for the turn timer', () => {
    const { gameId, aId, bId } = setUpTwoPlayerGame()

    leaveGame(gameId, aId)

    const game = getGame(gameId)!
    expect(game.players.find((p) => p.id === aId)?.isLeft).toBe(true)
    expect(game.status).toBe('finished')
    expect(game.winnerId).toBe(bId)
    expect(game.winReason).toBe('last-player-standing')
    expect(game.chatMessages).toContainEqual(
      expect.objectContaining({ kind: 'system', event: 'left', playerId: aId, text: 'Alice left the game.' })
    )
  })

  it("detaches the leaving player's own connection, unlike a timeout removal", () => {
    const created = createGame('Trio', 'Alice', fakeConnection())
    joinGame(created.game.id, 'Bob', fakeConnection())
    joinGame(created.game.id, 'Carol', fakeConnection())
    startGame(created.game.id, created.playerId)

    leaveGame(created.game.id, created.playerId)

    expect(getConnections(created.game.id)).toHaveLength(2)
  })

  it('does not disturb the turn when a player who is not up right now leaves', () => {
    const created = createGame('Trio', 'Alice', fakeConnection())
    joinGame(created.game.id, 'Bob', fakeConnection())
    const carol = joinGame(created.game.id, 'Carol', fakeConnection())
    const started = startGame(created.game.id, created.playerId)

    leaveGame(created.game.id, carol.playerId)

    const game = getGame(created.game.id)!
    expect(game.players.find((p) => p.id === carol.playerId)?.isLeft).toBe(true)
    expect(game.currentPlayerId).toBe(started.currentPlayerId)
    expect(game.turnEndsAt).toBe(started.turnEndsAt)
  })

  it('frees the slot when leaving before the game starts, same as a disconnect', () => {
    const created = createGame('Game', 'Alice', fakeConnection())
    joinGame(created.game.id, 'Bob', fakeConnection())

    leaveGame(created.game.id, created.playerId)

    const game = getGame(created.game.id)!
    expect(game.players.map((p) => p.name)).toEqual(['Bob'])
  })

  it('is a no-op if the player already left', () => {
    // Trio, not a pair, so the game is still in-progress (not finished)
    // after Alice's removal - otherwise the status check alone would skip
    // the second call and this wouldn't actually exercise the isLeft guard.
    const created = createGame('Trio', 'Alice', fakeConnection())
    joinGame(created.game.id, 'Bob', fakeConnection())
    joinGame(created.game.id, 'Carol', fakeConnection())
    startGame(created.game.id, created.playerId)

    vi.advanceTimersByTime(TURN_TIMEOUT_MS) // times out and removes Alice, turn passes to Bob
    const afterTimeout = getGame(created.game.id)!
    expect(afterTimeout.status).toBe('in-progress')

    leaveGame(created.game.id, created.playerId) // Alice "leaves" again after already being removed

    const game = getGame(created.game.id)!
    expect(game.currentPlayerId).toBe(afterTimeout.currentPlayerId)
    expect(game.chatMessages.filter((m) => m.kind === 'system' && m.text === 'Alice left the game.')).toHaveLength(1)
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

describe('postChatMessage', () => {
  it('appends a trimmed message from a player in the game and broadcasts', () => {
    const created = createGame('Game', 'Alice', fakeConnection())
    const bob = joinGame(created.game.id, 'Bob', fakeConnection())

    const game = postChatMessage(created.game.id, bob.playerId, '  hi there  ')

    // Not the only message - createGame/joinGame already posted their own
    // "joined" system messages - so check the newly-appended tail rather
    // than assuming an exact history length.
    expect(game.chatMessages[game.chatMessages.length - 1]).toMatchObject({
      kind: 'message',
      playerId: bob.playerId,
      playerName: 'Bob',
      colorIndex: 1,
      text: 'hi there'
    })
  })

  it('rejects an empty or whitespace-only message', () => {
    const created = createGame('Game', 'Alice', fakeConnection())
    expect(() => postChatMessage(created.game.id, created.playerId, '   ')).toThrow('empty')
  })

  it('rejects a message longer than the max length', () => {
    const created = createGame('Game', 'Alice', fakeConnection())
    const tooLong = 'a'.repeat(MAX_CHAT_MESSAGE_LENGTH + 1)
    expect(() => postChatMessage(created.game.id, created.playerId, tooLong)).toThrow('longer than')
  })

  it('rejects a sender who is not a player in the game', () => {
    const created = createGame('Game', 'Alice', fakeConnection())
    expect(() => postChatMessage(created.game.id, 'not-a-real-player-id', 'hi')).toThrow('Not a player')
  })

  it('rejects a message from a player who has left the game', () => {
    const created = createGame('Trio', 'Alice', fakeConnection())
    joinGame(created.game.id, 'Bob', fakeConnection())
    joinGame(created.game.id, 'Carol', fakeConnection())
    startGame(created.game.id, created.playerId)

    vi.advanceTimersByTime(TURN_TIMEOUT_MS) // times out Alice's turn, marking her isLeft

    expect(() => postChatMessage(created.game.id, created.playerId, 'still here?')).toThrow('left this game')
  })

  it('caps history at the max length, dropping the oldest messages', () => {
    const created = createGame('Game', 'Alice', fakeConnection())

    for (let i = 0; i < MAX_CHAT_HISTORY + 5; i++) {
      postChatMessage(created.game.id, created.playerId, `message ${i}`)
    }

    const game = getGame(created.game.id)!
    expect(game.chatMessages).toHaveLength(MAX_CHAT_HISTORY)
    expect(game.chatMessages[0].text).toBe('message 5')
    expect(game.chatMessages[game.chatMessages.length - 1].text).toBe(`message ${MAX_CHAT_HISTORY + 4}`)
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

  it('posts a system chat message announcing the player left', () => {
    const created = createGame('Game', 'Alice', fakeConnection())
    joinGame(created.game.id, 'Bob', fakeConnection())

    handleDisconnect(created.game.id, created.playerId)

    const game = getGame(created.game.id)!
    expect(game.chatMessages).toContainEqual(
      expect.objectContaining({ kind: 'system', event: 'left', playerId: created.playerId, text: 'Alice left the game.' })
    )
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
