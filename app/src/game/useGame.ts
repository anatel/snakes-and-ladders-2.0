import { useCallback, useEffect, useRef, useState } from 'react'
import { applyShortcutResolution, applyStraightMove, createInitialState, rollDie } from './gameLogic'
import { LADDERS } from './board'
import { playDiceRollSound, playLadderSound, playSnakeSound, playWinSound } from './sounds'
import type { GameState } from './types'

const ROLL_ANIMATION_MS = 600
const SHORTCUT_PAUSE_MS = 550
const COMPUTER_THINK_MS = 900

export function useGame() {
  const [state, setState] = useState<GameState>(createInitialState)
  const [isRolling, setIsRolling] = useState(false)
  const rollTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const shortcutTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const winSoundPlayedRef = useRef(false)

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

    const square = state.positions[state.currentPlayer]
    if (square in LADDERS) {
      playLadderSound()
    } else {
      playSnakeSound()
    }

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

  useEffect(() => {
    if (state.phase !== 'won' || winSoundPlayedRef.current) return
    winSoundPlayedRef.current = true
    playWinSound()
  }, [state.phase])

  const reset = useCallback(() => {
    clearTimeout(rollTimeoutRef.current)
    clearTimeout(shortcutTimeoutRef.current)
    winSoundPlayedRef.current = false
    setIsRolling(false)
    setState(createInitialState())
  }, [])

  const canRoll = state.phase === 'awaiting-roll' && state.currentPlayer === 'human' && !isRolling

  return { state, isRolling, canRoll, roll, reset }
}
