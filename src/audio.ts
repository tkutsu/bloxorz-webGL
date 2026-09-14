import { loadSettings, saveSettings } from './save'

export type SoundName = 'score' | 'landing' | 'fallVerti' | 'newLvl1' | 'newLvl2' | 'newLvl3' | 'newLvl4'
const SOUNDS: SoundName[] = ['score', 'landing', 'fallVerti', 'newLvl1', 'newLvl2', 'newLvl3', 'newLvl4']

const settings = loadSettings()
let ctx: AudioContext | null = null
let master: GainNode | null = null
const buffers = new Map<SoundName, AudioBuffer>()

function applyVolume(): void {
  if (master) master.gain.value = settings.muted ? 0 : settings.volume
}

/**
 * Browsers keep audio suspended until a user gesture, and iOS only counts the gesture if the
 * context is created or resumed inside its handler. Safe to call on every gesture.
 */
export function unlockAudio(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume()
    return
  }
  const audio = new AudioContext()
  ctx = audio
  master = audio.createGain()
  master.connect(audio.destination)
  applyVolume()
  for (const name of SOUNDS) {
    fetch(`/audio/${name}.mp3`)
      .then((response) => response.arrayBuffer())
      .then((data) => audio.decodeAudioData(data))
      .then((buffer) => buffers.set(name, buffer))
      .catch(() => {}) //a missing sound is not worth breaking the game over
  }
}

export function play(name: SoundName): void {
  const buffer = buffers.get(name)
  if (!ctx || !master || !buffer) return
  //a source node is single-use; creating one per play is the intended pattern, and lets sounds overlap
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(master)
  source.start()
}

export function getVolume(): number {
  return settings.volume
}

export function isMuted(): boolean {
  return settings.muted
}

export function setVolume(volume: number): void {
  settings.volume = volume
  settings.muted = false
  applyVolume()
  saveSettings(settings)
}

export function toggleMute(): boolean {
  settings.muted = !settings.muted
  applyVolume()
  saveSettings(settings)
  return settings.muted
}
