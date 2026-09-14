import { glob, TILE, type HeroPos, type Level, type Vec2 } from './state'
import { input, type Direction } from './input'
import { clearGame, saveGame } from './save'
import { play, type SoundName } from './audio'
import { pageUI, webGLStart } from './project.js'
import { drawScene } from './renderer'

//every animation was tuned in 2013 as "N frames" on a 60 Hz screen; time is measured in those frames
const FRAME_MS = 1000 / 60
export const MOVE_FRAMES = 8

//OS-level "reduce motion": level intro/outro tumbles play 8x faster and the finish cube stops spinning
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

type Axis = 'rotX' | 'rotY' | 'rotZ'

//resting pose per orientation: height offset, centre offset from the tile, rotation in degrees
const REST: Record<number, { height: number; fix: Vec2; rot: [number, number, number] }> = {
  0: { height: 0, fix: [0, 0], rot: [0, 0, 0] },
  1: { height: -0.5, fix: [-0.5, 0], rot: [0, 90, 0] },
  [-1]: { height: -0.5, fix: [0.5, 0], rot: [0, -90, 0] },
  2: { height: -0.5, fix: [0, 0.5], rot: [90, 0, 0] },
  [-2]: { height: -0.5, fix: [0, -0.5], rot: [-90, 0, 0] },
}

//axis and angle a roll adds, keyed by the orientation the block rolls into; multiplied by the move's sign
const ROLL: Record<number, { alongX: [Axis, number]; alongY: [Axis, number] }> = {
  0: { alongX: ['rotY', 90], alongY: ['rotX', 90] },
  1: { alongX: ['rotY', 90], alongY: ['rotZ', 90] },
  [-1]: { alongX: ['rotY', 90], alongY: ['rotZ', -90] },
  2: { alongX: ['rotZ', -90], alongY: ['rotX', 90] },
  [-2]: { alongX: ['rotZ', 90], alongY: ['rotX', 90] },
}

//the tile a lying block covers besides its own
const SECOND_CELL: Record<number, Vec2> = { 0: [0, 0], 1: [-1, 0], [-1]: [1, 0], 2: [0, -1], [-2]: [0, 1] }

const LEVEL_SOUNDS: SoundName[] = ['newLvl1', 'newLvl2', 'newLvl3', 'newLvl4']

let frameId = 0
let lastTime = 0

export function startLoop(): void {
  cancelAnimationFrame(frameId)
  lastTime = performance.now()
  frameId = requestAnimationFrame(tick)
}

export function stopLoop(): void {
  cancelAnimationFrame(frameId)
  frameId = 0
}

function tick(now: number): void {
  frameId = requestAnimationFrame(tick)
  //clamped: a backgrounded tab resumes with a gap that would otherwise skip whole animations
  const steps = Math.min(now - lastTime, 100) / FRAME_MS
  lastTime = now
  update(steps)
  checkConditions()
  //a win/loss can stop the loop; don't overwrite the animation's last frame, it stays on screen until the next level
  if (frameId) drawScene()
}

export function beginLevel(lvl: Level, savedPos: HeroPos | null): void {
  let start: HeroPos = [0, 0, 0]
  for (let y = 0; y < lvl.length; y++) {
    for (let x = 0; x < lvl[y].length; x++) {
      if (lvl[y][x] === TILE.START) start = [x, y, 0]
      else if (lvl[y][x] === TILE.END) glob.finishPos = [x, y]
    }
  }
  const pos = savedPos ?? start
  const rest = REST[pos[2]]
  glob.lvl = lvl
  glob.heroPos = glob.hp = glob.hpp = pos
  glob.count = -1
  glob.spring = false
  glob.heroHeight = glob.hhp = rest.height
  glob.heroFixPos = glob.heroFixPosPrev = rest.fix
  ;[glob.rotX, glob.rotY, glob.rotZ] = rest.rot
  ;[glob.rotXprev, glob.rotYprev, glob.rotZprev] = rest.rot
  glob.newGame = 100
  glob.wonGame = -1
  glob.lostGame = -1
  glob.xTrans = 0
  glob.yTrans = 0
  input.queuedMove = null
}

export function saveCurrentGame(): void {
  if (!glob.lvl) return
  saveGame({
    runSeed: glob.runSeed,
    level: glob.level,
    lvl: glob.lvl,
    heroPos: glob.heroPos,
    score: glob.score,
    topScoreShown: glob.topScoreShown,
  })
}

function update(steps: number): void {
  const effectSteps = reducedMotion.matches ? steps * 8 : steps
  if (!reducedMotion.matches) glob.rCube -= steps * FRAME_MS * 0.075
  if (glob.newGame > 0) {
    input.queuedMove = null
    glob.newGame = Math.max(0, glob.newGame - effectSteps)
    if (glob.newGame === 0) land()
    return
  }
  if (glob.wonGame > 0) {
    glob.wonGame = Math.max(0, glob.wonGame - effectSteps)
    return
  }
  if (glob.lostGame > 0) {
    glob.lostGame = Math.max(0, glob.lostGame - effectSteps)
    return
  }
  if (glob.count === -1) {
    if (!input.queuedMove) return
    startMove(input.queuedMove)
    input.queuedMove = null
  }
  glob.count = Math.min(MOVE_FRAMES, glob.count + steps)
  if (glob.count === MOVE_FRAMES) endMove()
}

function land(): void {
  play('landing')
  glob.newGame = -1
  glob.hhp = 0.1 //settles from just above the board
  glob.count = 0
  saveCurrentGame()
}

//heroPos (x , y , {0:standing 1:fallen horiz right -1:fallen horiz left 2:fallen verti down -2:fallen verti up})
function startMove(dir: Direction): void {
  const [x, y, o] = glob.heroPos
  let to: HeroPos
  //translation 1st integer: if standing, or horiz right, move 2 to the left, else 1 to the left
  //translation 3rd integer: if standing, you are now horiz left, else if horizontal, now standing, else if vertical, you are still vertical
  if (dir === 'left') to = [o === 0 || o === 1 ? x - 2 : x - 1, y, o === 0 ? -1 : o === 1 || o === -1 ? 0 : o]
  else if (dir === 'up') to = [x, o === 0 || o === 2 ? y - 2 : y - 1, o === 0 ? -2 : o === 2 || o === -2 ? 0 : o]
  else if (dir === 'right') to = [o === 0 || o === -1 ? x + 2 : x + 1, y, o === 0 ? 1 : o === 1 || o === -1 ? 0 : o]
  else to = [x, o === 0 || o === -2 ? y + 2 : y + 1, o === 0 ? 2 : o === 2 || o === -2 ? 0 : o]

  const dx = to[0] - x
  const [axis, degrees] = dx !== 0 ? ROLL[to[2]].alongX : ROLL[to[2]].alongY
  glob[axis] += degrees * Math.sign(dx !== 0 ? dx : to[1] - y)

  const rest = REST[to[2]]
  glob.heroHeight = rest.height
  glob.heroFixPos = rest.fix
  glob.hpp = glob.heroPos
  glob.hp = to
  glob.spring = true
  glob.count = 0
}

function endMove(): void {
  const lvl = glob.lvl as Level
  const [x, y, o] = glob.hp
  if (glob.spring && (lvl[y]?.[x] ?? TILE.EMPTY) !== TILE.EMPTY) play('fallVerti')
  ;[glob.rotX, glob.rotY, glob.rotZ] = REST[o].rot
  glob.rotXprev = glob.rotX
  glob.rotYprev = glob.rotY
  glob.rotZprev = glob.rotZ
  glob.heroPos = glob.hpp = glob.hp
  glob.hhp = glob.heroHeight
  glob.heroFixPosPrev = glob.heroFixPos
  glob.spring = false
  glob.count = -1
  if (!isOffBoard(lvl, glob.heroPos)) saveCurrentGame()
}

function isEmpty(lvl: Level, x: number, y: number): boolean {
  return (lvl[y]?.[x] ?? TILE.EMPTY) === TILE.EMPTY
}

function isOffBoard(lvl: Level, [x, y, o]: HeroPos): boolean {
  const [dx, dy] = SECOND_CELL[o]
  return isEmpty(lvl, x, y) || isEmpty(lvl, x + dx, y + dy)
}

//Win-loss conditions, checked only while the block is at rest
function checkConditions(): void {
  const lvl = glob.lvl
  if (!lvl || glob.newGame !== -1 || glob.count !== -1) return
  const [x, y, o] = glob.heroPos
  if (x === glob.finishPos[0] && y === glob.finishPos[1] && o === 0) {
    if (glob.wonGame === -1) {
      glob.wonGame = 100
      play(LEVEL_SOUNDS[glob.randEffect])
    } else if (glob.wonGame === 0) {
      stopLoop()
      clearGame()
      glob.level++
      glob.score++
      webGLStart()
    }
  } else if (isOffBoard(lvl, glob.heroPos)) {
    if (glob.lostGame === -1) {
      glob.lostGame = 100
    } else if (glob.lostGame === 0) {
      stopLoop()
      clearGame()
      glob.lvl = null
      glob.startTime = null
      glob.level = 0 //TRY AGAIN replays the same seed from its first level
      glob.score = 0
      glob.topScoreShown = false
      pageUI(-1)
    }
  }
}
