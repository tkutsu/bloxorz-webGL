import { glob } from './state'
import type { Direction } from './rules'
import { directionOnScreen } from './renderer'
import { changeQuality, isPlaying, newSeed, pause, setVolume, startFromMenu, toggleMute } from './ui'

export const input = {
  queuedMove: null as Direction | null, //consumed by the loop the next time the block is idle
}

//e.code is the physical key, so WASD keeps its shape on AZERTY/Dvorak layouts
const MOVE_KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key.toLowerCase() === 'm' && !e.repeat) {
    toggleMute()
    return
  }
  if (!isPlaying()) {
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
      e.preventDefault()
      startFromMenu()
    } else if (e.key.toLowerCase() === 'n') {
      newSeed()
    }
    return
  }
  const move = MOVE_KEYS[e.code]
  if (move) {
    e.preventDefault()
    input.queuedMove = move
    return
  }
  if (e.repeat) return
  const digit = /^Digit(\d)$/.exec(e.code)
  if (e.code === 'Escape') pause()
  else if (e.key.toLowerCase() === 'q') changeQuality()
  else if (digit) setVolume(Number(digit[1]))
}

//touch: a quick flick rolls the block, holding before dragging orbits the camera; mouse: dragging always orbits
const SWIPE_PX = 30
const HOLD_MS = 250

interface Gesture {
  id: number
  x: number
  y: number
  time: number
  mode: 'pending' | 'camera' | 'done'
  xTrans: number
  yTrans: number
}
let gesture: Gesture | null = null

function beginCamera(g: Gesture, e: PointerEvent): void {
  g.mode = 'camera'
  g.x = e.clientX
  g.y = e.clientY
  g.xTrans = glob.xTrans
  g.yTrans = glob.yTrans
}

export function initInput(canvas: HTMLCanvasElement): void {
  window.addEventListener('keydown', onKeyDown)

  canvas.addEventListener('pointerdown', (e) => {
    if (gesture) return //second finger: ignore
    e.preventDefault()
    canvas.setPointerCapture(e.pointerId)
    gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, time: e.timeStamp, mode: 'pending', xTrans: 0, yTrans: 0 }
    if (e.pointerType === 'mouse') {
      beginCamera(gesture, e)
      canvas.style.cursor = 'all-scroll'
    }
  })
  canvas.addEventListener('pointermove', (e) => {
    const g = gesture
    if (!g || g.id !== e.pointerId || g.mode === 'done') return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (g.mode === 'pending') {
      if (e.timeStamp - g.time >= HOLD_MS) {
        beginCamera(g, e)
      } else if (Math.hypot(dx, dy) >= SWIPE_PX) {
        input.queuedMove = directionOnScreen(dx, dy)
        g.mode = 'done'
      }
      return
    }
    glob.xTrans = g.xTrans + dx / 100
    glob.yTrans = g.yTrans - dy / 100
  })
  const end = (e: PointerEvent) => {
    if (gesture?.id !== e.pointerId) return
    gesture = null
    canvas.style.cursor = 'default'
  }
  canvas.addEventListener('pointerup', end)
  canvas.addEventListener('pointercancel', end)
}
