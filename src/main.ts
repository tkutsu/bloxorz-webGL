import './project.css'
import { glob } from './state'
import { initUI, pageUI } from './project.js'
import { initInput } from './input'
import { migrateLegacySave } from './save'

declare function loadAsset(): void

const canvas = document.getElementById('c') as HTMLCanvasElement
glob.canvas = canvas
migrateLegacySave()
loadAsset()
initUI()
initInput(canvas)
pageUI()
