export type PlayerId = 'human' | 'computer'

export type TurnPhase =
  | 'awaiting-roll'
  | 'rolling'
  | 'moving'
  | 'resolving-shortcut'
  | 'won'

export interface GameState {
  positions: Record<PlayerId, number>
  currentPlayer: PlayerId
  phase: TurnPhase
  lastRoll: number | null
  winner: PlayerId | null
}
