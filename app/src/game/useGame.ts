import { useCallback, useEffect, useRef, useState } from 'react'
import { applyShortcutResolution, applyStraightMove, createInitialState, rollDie } from './gameLogic'
import { playDiceRollSound } from './diceSound'
import type { GameState } from './types'

const ROLL_ANIMATION_MS = 600
const SHORTCUT_PAUSE_MS = 550
const COMPUTER_THINK_MS = 900

export function useGame() {
  const [state, setState] = useState<GameState>(createInitialState)
  const [isRolling, setIsRolling] = useState(false)
  const rollTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const shortcutTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const roll = useCallback(() => {
    setIsRolling(true)
    playDiceRollSound()

    rollTimeoutRef.current = setTimeout(() => {
      const value = rollDie()
      setState((prev) => applyStraightMove(prev, value))
      setIsRolling(false)
    }, ROLL_ANIMATION_MS)
  }, [])

  useEffect(() => {
    return () => {
      clearTimeout(rollTimeoutRef.current)
      clearTimeout(shortcutTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (state.phase !== 'resolving-shortcut') return
    shortcutTimeoutRef.current = setTimeout(() => {
      setState((prev) => applyShortcutResolution(prev))
    }, SHORTCUT_PAUSE_MS)
    return () => clearTimeout(shortcutTimeoutRef.current)
  }, [state.phase, state.currentPlayer, state.positions])

  useEffect(() => {
    if (state.phase !== 'awaiting-roll' || state.currentPlayer !== 'computer' || isRolling) {
      return
    }
    const timer = setTimeout(roll, COMPUTER_THINK_MS)
    return () => clearTimeout(timer)
  }, [state.phase, state.currentPlayer, isRolling, roll])

  const reset = useCallback(() => {
    clearTimeout(rollTimeoutRef.current)
    clearTimeout(shortcutTimeoutRef.current)
    setIsRolling(false)
    setState(createInitialState())
  }, [])

  const canRoll = state.phase === 'awaiting-roll' && state.currentPlayer === 'human' && !isRolling

  return { state, isRolling, canRoll, roll, reset }
}
