import { Toaster } from 'sonner'
import { ModeSelect } from './cmps/ModeSelect'

export function App() {
  return (
    <>
      <ModeSelect />
      <Toaster position="top-center" richColors />
    </>
  )
}
