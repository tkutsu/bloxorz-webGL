import { glob } from './state'
import { changeQuality, isPlaying, pause, setVolume, startFromMenu } from './project.js'

export type Direction = 'up' | 'right' | 'down' | 'left'

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
  if (!isPlaying()) {
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
      e.preventDefault()
      startFromMenu()
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

let drag: { x: number; y: number; xTrans: number; yTrans: number } | null = null

export function initInput(canvas: HTMLCanvasElement): void {
  window.addEventListener('keydown', onKeyDown)

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    canvas.setPointerCapture(e.pointerId)
    canvas.style.cursor = 'all-scroll'
    drag = { x: e.clientX, y: e.clientY, xTrans: glob.xTrans, yTrans: glob.yTrans }
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return
    glob.xTrans = drag.xTrans + (e.clientX - drag.x) / 100
    glob.yTrans = drag.yTrans - (e.clientY - drag.y) / 100
  })
  const endDrag = () => {
    drag = null
    canvas.style.cursor = 'default'
  }
  canvas.addEventListener('pointerup', endDrag)
  canvas.addEventListener('pointercancel', endDrag)
}
