import './project.css'
import { glob } from './state'
import { initUI, pageUI } from './project.js'
import { initInput } from './input'
import { unlockAudio } from './audio'
import { clearGame, loadGame, migrateLegacySave } from './save'
import { parseSeed, randomSeed } from './rng'

const canvas = document.getElementById('c') as HTMLCanvasElement
glob.canvas = canvas
migrateLegacySave()
const urlSeed = parseSeed(new URLSearchParams(location.search).get('seed'))
const saved = loadGame()
if (urlSeed !== null && saved && saved.runSeed !== urlSeed) clearGame() //a shared link means "play this seed"
glob.runSeed = urlSeed ?? saved?.runSeed ?? randomSeed()
for (const gesture of ['pointerdown', 'pointerup', 'keydown']) window.addEventListener(gesture, unlockAudio)
initUI()
initInput(canvas)
pageUI()
