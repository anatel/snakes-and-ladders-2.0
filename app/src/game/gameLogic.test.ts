import { describe, expect, it } from 'vitest'
import { applyShortcutResolution, applyStraightMove, createInitialState } from './gameLogic'
import type { GameState } from './types'

function stateWith(overrides: Partial<GameState>): GameState {
  return { ...createInitialState(), ...overrides }
}

describe('applyStraightMove', () => {
  it('moves the current player forward by the roll amount', () => {
    const state = stateWith({ positions: { human: 10, computer: 0 }, currentPlayer: 'human' })

    const next = applyStraightMove(state, 4)

    expect(next.positions.human).toBe(14)
  })

  it('passes the turn to the other player after a plain move', () => {
    const state = stateWith({ currentPlayer: 'human' })

    const next = applyStraightMove(state, 3)

    expect(next.currentPlayer).toBe('computer')
    expect(next.phase).toBe('awaiting-roll')
  })

  it('lands on the snake head first without sliding down yet', () => {
    // square 16 is a snake head that drops to square 6
    const state = stateWith({ positions: { human: 10, computer: 0 }, currentPlayer: 'human' })

    const next = applyStraightMove(state, 6)

    expect(next.positions.human).toBe(16)
    expect(next.phase).toBe('resolving-shortcut')
    expect(next.currentPlayer).toBe('human')
  })

  it('lands on the ladder base first without climbing yet', () => {
    // square 1 is a ladder base that climbs to square 38
    const state = stateWith({ positions: { human: 0, computer: 0 }, currentPlayer: 'human' })

    const next = applyStraightMove(state, 1)

    expect(next.positions.human).toBe(1)
    expect(next.phase).toBe('resolving-shortcut')
    expect(next.currentPlayer).toBe('human')
  })

  it('does not move the player when the roll would overshoot square 100', () => {
    const state = stateWith({ positions: { human: 98, computer: 0 }, currentPlayer: 'human' })

    const next = applyStraightMove(state, 5)

    expect(next.positions.human).toBe(98)
    expect(next.currentPlayer).toBe('computer')
  })

  it('declares a winner when a player lands exactly on square 100', () => {
    const state = stateWith({ positions: { human: 94, computer: 0 }, currentPlayer: 'human' })

    const next = applyStraightMove(state, 6)

    expect(next.positions.human).toBe(100)
    expect(next.phase).toBe('won')
    expect(next.winner).toBe('human')
  })
})

describe('applyShortcutResolution', () => {
  it('slides the player down to the snake destination and passes the turn', () => {
    const state = stateWith({
      positions: { human: 16, computer: 0 },
      currentPlayer: 'human',
      phase: 'resolving-shortcut'
    })

    const next = applyShortcutResolution(state)

    expect(next.positions.human).toBe(6)
    expect(next.phase).toBe('awaiting-roll')
    expect(next.currentPlayer).toBe('computer')
  })

  it('climbs the player up to the ladder destination and passes the turn', () => {
    const state = stateWith({
      positions: { human: 1, computer: 0 },
      currentPlayer: 'human',
      phase: 'resolving-shortcut'
    })

    const next = applyShortcutResolution(state)

    expect(next.positions.human).toBe(38)
    expect(next.phase).toBe('awaiting-roll')
    expect(next.currentPlayer).toBe('computer')
  })
})
