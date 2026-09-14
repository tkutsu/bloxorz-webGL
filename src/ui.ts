//THEMISTOKLIS KOUTSOURIS - TUC - GRAPHICS COURSE - BLOXORZ IMPLEMENTED WITH WEBGL
import { glob as game } from './state'
import { beginLevel, startLoop, stopLoop, saveCurrentGame } from './loop'
import { clearGame, getTopScore, loadGame, setTopScore } from './save'
import { getVolume, isMuted, play, setVolume as setAudioVolume, toggleMute as toggleAudioMute } from './audio'
import { initRenderer, resizeCanvas } from './renderer'
import { levelFor } from './level'
import { randomSeed, seedToString } from './rng'

let starting = false //true from a start request until the level runs, so a double Enter can't start two loops

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

function canvas(): HTMLCanvasElement {
  return game.canvas as HTMLCanvasElement
}

function prompts(className: string): HTMLElement[] {
  return Array.from(document.getElementsByClassName(className)) as HTMLElement[]
}

//binds the menu handlers, once
export function initUI(): void {
  for (const prompt of prompts('prompt')) prompt.addEventListener('pointerdown', startFromMenu)
  el('newSeed').addEventListener('click', newSeed)
  el('shareSeed').addEventListener('click', shareSeed)
  el('pause').addEventListener('click', pause)
  el('mute').addEventListener('click', toggleMute)
  refreshMute()
}

//shows the menu: TRY AGAIN after a loss, CONTINUE when a save exists, NEW GAME otherwise
export function pageUI(result?: -1): void {
  refreshSeed()
  document.body.classList.remove('playing')
  canvas().style.display = 'none'
  el('help').style.display = 'block'
  if (result === -1) el('promptLose').style.display = 'block'
  else if (loadGame()) el('promptCont').style.display = 'block'
  else el('promptPlay').style.display = 'block'
  refreshScore()
}

export function startFromMenu(): void {
  if (starting) return
  starting = true
  for (const prompt of prompts('prompt')) prompt.style.transform = 'scale(200)'
  el('help').style.opacity = '0'
  window.setTimeout(webGLStart, 500)
}

export function isPlaying(): boolean {
  return game.lvl !== null && canvas().style.display !== 'none'
}

//Escape or the pause button: back to the menu, CONTINUE resumes from the last resting position
export function pause(): void {
  if (game.newGame !== -1 || game.wonGame !== -1 || game.lostGame !== -1) return
  if (game.count === -1) saveCurrentGame()
  stopLoop()
  canvas().style.display = 'none'
  document.body.classList.remove('playing')
  el('help').style.display = 'block'
  el('promptCont').style.display = 'block'
  game.startTime = null
  game.lvl = null
}

//[Q] : changes quality
export function changeQuality(): void {
  if (game.glQuality > 2) {
    game.glQuality = 1
    popup('Quality up')
  } else {
    game.glQuality += 0.34
    popup('Quality down')
  }
  resizeCanvas()
}

//0~9 : changes volume
export function setVolume(digit: number): void {
  const current = isMuted() ? 0 : getVolume()
  const next = digit / 10
  if (current !== next) {
    if (digit === 0) popup('Volume down (mute)')
    else if (digit === 9) popup('Volume up (max)')
    else popup(`Volume ${current > next ? 'down' : 'up'} (${digit})`)
  }
  setAudioVolume(next)
  refreshMute()
}

//[M] or the speaker button : mute / unmute, remembering the volume
export function toggleMute(): void {
  popup(toggleAudioMute() ? 'Sound off' : 'Sound on')
  refreshMute()
}

function refreshMute(): void {
  el('mute').classList.toggle('muted', isMuted() || getVolume() === 0)
}

//starts (or resumes) a level
export async function webGLStart(): Promise<void> {
  resetPrompt()
  if (!(await initRenderer(canvas()))) {
    showError('WEBGL2 NOT SUPPORTED')
    return
  }
  canvas().style.display = 'block'
  document.body.classList.add('playing')
  el('help').style.display = 'none'
  const save = loadGame()
  if (save) {
    game.runSeed = save.runSeed
    game.level = save.level
    game.score = save.score
    game.topScoreShown = save.topScoreShown
  }
  const next = levelFor(game.runSeed, game.level)
  beginLevel(save ? save.lvl : next.lvl, save ? save.heroPos : null)
  game.randEffect = next.randEffect //the effect for loading the level
  refreshSeed()
  resizeCanvas()
  scoreCheck() //checks if time bonus / top score apply
  starting = false
  startLoop()
}

function showError(text: string): void {
  const prompt = el('promptPlay')
  prompt.textContent = text
  prompt.style.display = 'block'
  prompt.style.transform = 'scale(1)'
}

//flash the glass, play the sound, then shrink the prompt into the score corner
function celebrate(promptId: string, after: () => void): void {
  play('score')
  const glass = el('glass').style
  glass.display = 'block'
  glass.opacity = '1'
  const prompt = el(promptId).style
  prompt.display = 'block'
  window.setTimeout(() => {
    glass.opacity = '0'
    prompt.transform = 'scale(1)'
    prompt.bottom = '0.2em'
    prompt.left = '0.4em'
    window.setTimeout(after, 600)
  }, 500)
}

//FAST! bonus: finishing the previous level quickly (time scales with its size) is worth an extra point
function scoreCheck(): void {
  const now = Date.now()
  const lvl = game.lvl
  if (game.startTime && lvl && (now - game.startTime) / 1000 < (3 + lvl.length + lvl[0].length) / 3) {
    celebrate('promptTime', () => {
      game.score++
      resetPrompt()
      refreshScore()
    })
  } else {
    refreshScore()
  }
  game.startTime = now
}

function refreshScore(): void {
  let topScore = getTopScore()
  if (!game.topScoreShown && topScore <= game.score - 1) {
    game.topScoreShown = true
    celebrate('promptTop', resetPrompt)
  }
  if (topScore < game.score) {
    topScore = game.score
    setTopScore(topScore)
  }
  el('score').textContent =
    canvas().style.display === 'none' || game.topScoreShown ? `TOP SCORE: ${topScore}` : `SCORE: ${game.score}`
}

//reset and hide prompts
function resetPrompt(): void {
  const glass = el('glass').style
  glass.display = 'none'
  glass.opacity = '1'
  for (const prompt of prompts('prompt')) {
    prompt.style.display = 'none'
    prompt.style.transform = 'scale(1.9)'
  }
  for (const prompt of prompts('scorePrompt')) {
    prompt.style.display = 'none'
    prompt.style.transform = 'scale(4)'
    prompt.style.bottom = '50%'
    prompt.style.left = '20%'
  }
  el('help').style.opacity = '0.5'
}

//small fading notice in the corner; waits if one is already showing
function popup(text: string): void {
  const pop = el('popup')
  const style = pop.style
  const wait = Number(style.opacity) > 0 ? 1000 : 0
  window.setTimeout(() => {
    if (style.display === 'block') return
    style.display = 'block'
    pop.textContent = text
    window.setTimeout(() => {
      style.opacity = '0.5'
      window.setTimeout(() => {
        style.opacity = '0'
        window.setTimeout(() => {
          style.display = 'none'
          pop.textContent = ''
        }, 300)
      }, 1000)
    }, 10)
  }, wait)
}

//shows the run's seed and level, and keeps ?seed= in the address bar so the URL is always shareable
function refreshSeed(): void {
  const url = new URL(location.href)
  url.searchParams.set('seed', seedToString(game.runSeed))
  history.replaceState(null, '', url)
  el('seedValue').textContent = `${seedToString(game.runSeed)} · LEVEL ${game.level + 1}`
  el('newSeed').style.display = isPlaying() ? 'none' : 'inline'
}

//menu only: abandon the current run and roll a fresh seed
export function newSeed(): void {
  if (isPlaying() || starting) return
  clearGame()
  game.runSeed = randomSeed()
  game.level = 0
  game.score = 0
  game.topScoreShown = false
  resetPrompt()
  pageUI()
}

function shareSeed(): void {
  const url = location.href
  //share sheet on phones; desktop browsers mostly lack navigator.share (typed as always present)
  if (typeof navigator.share === 'function') {
    navigator.share({ title: 'Bloxorz', url }).catch(() => {})
  } else {
    navigator.clipboard.writeText(url).then(() => popup('Link copied'), () => {})
  }
}
