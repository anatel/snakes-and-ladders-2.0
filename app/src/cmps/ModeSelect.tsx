import { useState } from 'react'
import { Multiplayer } from '../mp/Multiplayer'
import { Game } from './Game'

type Mode = 'select' | 'computer' | 'multiplayer'

export function ModeSelect() {
  const [mode, setMode] = useState<Mode>('select')

  if (mode === 'computer') return <Game />
  if (mode === 'multiplayer') return <Multiplayer onExit={() => setMode('select')} />

  return (
    <div className="mode-select">
      <h1 className="game-title">Snakes and Ladders</h1>
      <p className="game-status">Choose how you want to play</p>
      <div className="mode-select-options">
        <button type="button" className="mode-select-option" onClick={() => setMode('computer')}>
          Play vs Computer
        </button>
        <button type="button" className="mode-select-option" onClick={() => setMode('multiplayer')}>
          Play Online
        </button>
      </div>
    </div>
  )
}
