import { BOARD_SIZE, getShortcut } from './board'
import type { GameState, PlayerId } from './types'

export function createInitialState(): GameState {
  return {
    positions: { human: 0, computer: 0 },
    currentPlayer: 'human',
    phase: 'awaiting-roll',
    lastRoll: null,
    winner: null
  }
}

export function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1
}

function otherPlayer(player: PlayerId): PlayerId {
  return player === 'human' ? 'computer' : 'human'
}

// Pure reducer step: given the roll for the current player, returns the
// square they land on after movement and any snake/ladder resolution,
// plus whether that roll wins the game. Movement/turn-switch is applied
// by the caller so the UI can animate each step separately.
export function resolveMove(state: GameState, roll: number): GameState {
  const from = state.positions[state.currentPlayer]
  const straightMove = from + roll

  if (straightMove > BOARD_SIZE) {
    // Overshoot: classic rule requires an exact roll to reach square 100.
    return {
      ...state,
      lastRoll: roll,
      phase: 'awaiting-roll',
      currentPlayer: otherPlayer(state.currentPlayer)
    }
  }

  const shortcutTarget = getShortcut(straightMove)
  const finalSquare = shortcutTarget ?? straightMove

  if (straightMove === BOARD_SIZE) {
    return {
      ...state,
      lastRoll: roll,
      positions: { ...state.positions, [state.currentPlayer]: BOARD_SIZE },
      phase: 'won',
      winner: state.currentPlayer
    }
  }

  return {
    ...state,
    lastRoll: roll,
    positions: { ...state.positions, [state.currentPlayer]: finalSquare },
    phase: 'awaiting-roll',
    currentPlayer: otherPlayer(state.currentPlayer)
  }
}
