import { Toaster } from 'sonner'
import { Game } from './cmps/Game'

export function App() {
  return (
    <>
      <Game />
      <Toaster position="top-center" richColors />
    </>
  )
}
