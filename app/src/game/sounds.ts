let sharedContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!sharedContext) sharedContext = new AudioContext()
  if (sharedContext.state === 'suspended') void sharedContext.resume()
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

function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  type: OscillatorType,
  peakGain: number
): void {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, startTime)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(startTime)
  osc.stop(startTime + duration + 0.02)
}

// Synthesized dice-clatter: a burst of short filtered noise "clicks" that
// approximates a die tumbling and settling. All sounds in this file are
// synthesized rather than bundled audio files, to avoid depending on a
// fetched asset of unverifiable license/source.
export function playDiceRollSound(): void {
  const ctx = getAudioContext()

  const clickCount = 6 + Math.floor(Math.random() * 3)
  let time = ctx.currentTime

  for (let i = 0; i < clickCount; i++) {
    const progress = i / clickCount
    playClick(ctx, time, 0.5 * (1 - progress * 0.6))
    time += 0.03 + progress * 0.05
  }
}

// Bright, quick ascending chime - the "climbing up" feeling of a ladder.
export function playLadderSound(): void {
  const ctx = getAudioContext()
  const notes = [392.0, 523.25, 659.25, 783.99, 1046.5] // G4, C5, E5, G5, C6
  let time = ctx.currentTime

  for (const freq of notes) {
    playTone(ctx, freq, time, 0.14, 'triangle', 0.22)
    time += 0.09
  }
}

// Descending buzzy glide with a wobbling vibrato - the "uh-oh, slithering
// down" feeling of a snake.
export function playSnakeSound(): void {
  const ctx = getAudioContext()
  const startTime = ctx.currentTime
  const duration = 0.55

  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(700, startTime)
  osc.frequency.exponentialRampToValueAtTime(140, startTime + duration)

  const vibrato = ctx.createOscillator()
  vibrato.frequency.value = 14
  const vibratoDepth = ctx.createGain()
  vibratoDepth.gain.value = 25
  vibrato.connect(vibratoDepth)
  vibratoDepth.connect(osc.frequency)

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(1800, startTime)
  filter.frequency.exponentialRampToValueAtTime(300, startTime + duration)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.28, startTime)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

  osc.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)

  osc.start(startTime)
  vibrato.start(startTime)
  osc.stop(startTime + duration + 0.02)
  vibrato.stop(startTime + duration + 0.02)
}

// Triumphant rising arpeggio that resolves into a held major chord - the
// fanfare feeling of winning the game.
export function playWinSound(): void {
  const ctx = getAudioContext()
  let time = ctx.currentTime

  const arpeggio = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
  for (const freq of arpeggio) {
    playTone(ctx, freq, time, 0.16, 'triangle', 0.25)
    time += 0.1
  }

  const chord = [1046.5, 1318.51, 1568.0] // C6, E6, G6
  for (const freq of chord) {
    playTone(ctx, freq, time, 0.7, 'triangle', 0.2)
  }
}
