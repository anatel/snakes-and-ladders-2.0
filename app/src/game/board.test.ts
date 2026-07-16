import { describe, expect, it } from 'vitest'
import { getShortcut, getSquarePosition } from './board'

describe('getSquarePosition', () => {
  it('places square 1 at the bottom-left', () => {
    expect(getSquarePosition(1)).toEqual({ row: 0, col: 0 })
  })

  it('places square 10 at the bottom-right (row 0 runs left-to-right)', () => {
    expect(getSquarePosition(10)).toEqual({ row: 0, col: 9 })
  })

  it('places square 11 at the left on row 1 (boustrophedon reverses direction)', () => {
    expect(getSquarePosition(11)).toEqual({ row: 1, col: 9 })
  })

  it('places square 100 at the top-left', () => {
    expect(getSquarePosition(100)).toEqual({ row: 9, col: 0 })
  })
})

describe('getShortcut', () => {
  it('returns the ladder destination for a ladder base', () => {
    expect(getShortcut(1)).toBe(38)
  })

  it('returns the snake destination for a snake head', () => {
    expect(getShortcut(16)).toBe(6)
  })

  it('returns null for a plain square', () => {
    expect(getShortcut(2)).toBeNull()
  })
})
