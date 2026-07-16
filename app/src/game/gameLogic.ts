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

// First leg of a turn: move the current player by the roll amount only,
// without resolving any snake/ladder yet. If the landing square starts a
// snake or ladder, the turn stays open in the 'resolving-shortcut' phase
// so the UI can show the piece land there before sliding further.
export function applyStraightMove(state: GameState, roll: number): GameState {
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

  if (straightMove === BOARD_SIZE) {
    return {
      ...state,
      lastRoll: roll,
      positions: { ...state.positions, [state.currentPlayer]: BOARD_SIZE },
      phase: 'won',
      winner: state.currentPlayer
    }
  }

  const hasShortcut = getShortcut(straightMove) !== null

  return {
    ...state,
    lastRoll: roll,
    positions: { ...state.positions, [state.currentPlayer]: straightMove },
    phase: hasShortcut ? 'resolving-shortcut' : 'awaiting-roll',
    currentPlayer: hasShortcut ? state.currentPlayer : otherPlayer(state.currentPlayer)
  }
}

// Second leg of a turn: called only while phase is 'resolving-shortcut',
// after the UI has had time to animate the piece landing on the snake
// head or ladder base. Slides the piece to the shortcut's destination
// and passes the turn.
export function applyShortcutResolution(state: GameState): GameState {
  const square = state.positions[state.currentPlayer]
  const destination = getShortcut(square)
  if (destination === null) return state

  return {
    ...state,
    positions: { ...state.positions, [state.currentPlayer]: destination },
    phase: 'awaiting-roll',
    currentPlayer: otherPlayer(state.currentPlayer)
  }
}
