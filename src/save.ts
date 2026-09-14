import { randomSeed } from './rng'
import type { HeroPos, Level } from './state'

const SAVE_KEY = 'bloxorzGL.save.v2'
const TOP_SCORE_KEY = 'bloxorzGL.score'
const LEGACY_PREFIX = 'bloxorzGL.gameInProgress.'

export interface SaveGame {
  runSeed: number
  level: number
  lvl: Level //stored, not regenerated, so saves survive changes to the generator
  heroPos: HeroPos
  score: number
  topScoreShown: boolean
}

//localStorage throws in private modes, when full, or when disabled; the game must keep running regardless
function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    //resume just won't be available
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    //nothing to clean up
  }
}

export function saveGame(save: SaveGame): void {
  write(SAVE_KEY, JSON.stringify(save))
}

export function loadGame(): SaveGame | null {
  const raw = read(SAVE_KEY)
  if (!raw) return null
  try {
    const save = JSON.parse(raw) as SaveGame
    return typeof save.runSeed === 'number' && Array.isArray(save.lvl) && Array.isArray(save.heroPos) ? save : null
  } catch {
    return null
  }
}

export function clearGame(): void {
  remove(SAVE_KEY)
}

export function getTopScore(): number {
  return Number(read(TOP_SCORE_KEY)) || 0
}

export function setTopScore(score: number): void {
  write(TOP_SCORE_KEY, String(score))
}

/** Converts the 2013 format (13 keys rewritten every frame) into one v2 blob, then deletes the old keys. */
export function migrateLegacySave(): void {
  let keys: string[]
  try {
    keys = Object.keys(localStorage).filter((key) => key.startsWith(LEGACY_PREFIX))
  } catch {
    return
  }
  if (keys.length === 0) return

  const lvl = read(LEGACY_PREFIX + 'lvl')
  const heroPos = read(LEGACY_PREFIX + 'heroPosPrev')
  if (lvl && heroPos && !read(SAVE_KEY)) {
    try {
      const [x, y, orientation] = JSON.parse(heroPos) as number[]
      saveGame({
        runSeed: randomSeed(),
        level: 0,
        lvl: JSON.parse(lvl) as Level,
        heroPos: [x, y, orientation],
        score: Number(read(LEGACY_PREFIX + 'score')) || 0,
        topScoreShown: false,
      })
    } catch {
      //corrupt legacy save: drop it
    }
  }
  keys.forEach(remove)
}
