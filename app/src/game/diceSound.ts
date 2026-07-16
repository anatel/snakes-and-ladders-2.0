let sharedContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!sharedContext) sharedContext = new AudioContext()
  return sharedContext
}

function playClick(ctx: AudioContext, startTime: number, gainPeak: number): void {
  const bufferSize = Math.floor(ctx.sampleRate * 0.03)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
  }

  const noise = ctx.createBufferSource()
  noise.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1800 + Math.random() * 800

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(gainPeak, startTime)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.04)

  noise.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)

  noise.start(startTime)
  noise.stop(startTime + 0.05)
}

// Synthesized dice-clatter: a burst of short filtered noise "clicks" that
// approximates a die tumbling and settling. Avoids bundling a fetched
// audio file of unverifiable license/source.
export function playDiceRollSound(): void {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') void ctx.resume()

  const clickCount = 6 + Math.floor(Math.random() * 3)
  let time = ctx.currentTime

  for (let i = 0; i < clickCount; i++) {
    const progress = i / clickCount
    playClick(ctx, time, 0.5 * (1 - progress * 0.6))
    time += 0.03 + progress * 0.05
  }
}
