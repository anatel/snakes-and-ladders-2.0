import { describe, expect, it } from 'vitest'
import { createInitialState, resolveMove } from './gameLogic'
import type { GameState } from './types'

function stateWith(overrides: Partial<GameState>): GameState {
  return { ...createInitialState(), ...overrides }
}

describe('resolveMove', () => {
  it('moves the current player forward by the roll amount', () => {
    const state = stateWith({ positions: { human: 10, computer: 0 }, currentPlayer: 'human' })

    const next = resolveMove(state, 4)

    expect(next.positions.human).toBe(14)
  })

  it('passes the turn to the other player after a normal move', () => {
    const state = stateWith({ currentPlayer: 'human' })

    const next = resolveMove(state, 3)

    expect(next.currentPlayer).toBe('computer')
    expect(next.phase).toBe('awaiting-roll')
  })

  it('slides down a snake when landing on its head', () => {
    // square 16 is a snake head that drops to square 6
    const state = stateWith({ positions: { human: 10, computer: 0 }, currentPlayer: 'human' })

    const next = resolveMove(state, 6)

    expect(next.positions.human).toBe(6)
  })

  it('climbs a ladder when landing on its base', () => {
    // square 1 is a ladder base that climbs to square 38
    const state = stateWith({ positions: { human: 0, computer: 0 }, currentPlayer: 'human' })

    const next = resolveMove(state, 1)

    expect(next.positions.human).toBe(38)
  })

  it('does not move the player when the roll would overshoot square 100', () => {
    const state = stateWith({ positions: { human: 98, computer: 0 }, currentPlayer: 'human' })

    const next = resolveMove(state, 5)

    expect(next.positions.human).toBe(98)
    expect(next.currentPlayer).toBe('computer')
  })

  it('declares a winner when a player lands exactly on square 100', () => {
    const state = stateWith({ positions: { human: 94, computer: 0 }, currentPlayer: 'human' })

    const next = resolveMove(state, 6)

    expect(next.positions.human).toBe(100)
    expect(next.phase).toBe('won')
    expect(next.winner).toBe('human')
  })
})
