import { useEffect, useRef, useState } from 'react'
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, type LucideIcon } from 'lucide-react'

const FACE_ICONS: Record<number, LucideIcon> = {
  1: Dice1,
  2: Dice2,
  3: Dice3,
  4: Dice4,
  5: Dice5,
  6: Dice6
}

const CYCLE_INTERVAL_MS = 80

interface DiceProps {
  value: number | null
  isRolling: boolean
  canRoll: boolean
  onRoll: () => void
}

export function Dice({ value, isRolling, canRoll, onRoll }: DiceProps) {
  const [displayFace, setDisplayFace] = useState(value ?? 1)
  const cycleRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    if (isRolling) {
      cycleRef.current = setInterval(() => {
        setDisplayFace(1 + Math.floor(Math.random() * 6))
      }, CYCLE_INTERVAL_MS)
    } else {
      clearInterval(cycleRef.current)
      if (value !== null) setDisplayFace(value)
    }
    return () => clearInterval(cycleRef.current)
  }, [isRolling, value])

  const FaceIcon = FACE_ICONS[displayFace]

  return (
    <button
      type="button"
      className={'dice' + (isRolling ? ' dice--rolling' : '')}
      onClick={onRoll}
      disabled={!canRoll}
      aria-label="Roll the die"
    >
      <FaceIcon size={48} strokeWidth={1.5} />
    </button>
  )
}
