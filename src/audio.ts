import { glob } from './state'

export type SoundName = 'score' | 'landing' | 'fallVerti' | 'newLvl1' | 'newLvl2' | 'newLvl3' | 'newLvl4'

declare const sounds: Record<SoundName, HTMLAudioElement>

export function play(name: SoundName): void {
  const sound = sounds[name]
  sound.volume = glob.volume
  //rejected by autoplay policy until the first user gesture
  sound.play().catch(() => {})
}
