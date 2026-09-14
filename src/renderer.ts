import vertexShaderSource from './shaders/cube.vert?raw'
import fragmentShaderSource from './shaders/cube.frag?raw'
import { CUBE_COLORS, CUBE_INDICES, CUBE_POSITIONS, CUBE_UVS } from './cube'
import { m4 } from './m4'
import { glob, TILE } from './state'
import { MOVE_FRAMES } from './loop'

const TEXTURES = ['block', 'start', 'end', 'hero', 'endL', 'endDL', 'endD', 'endDR', 'endR', 'endUR', 'endU', 'endUL'] as const
type TextureName = (typeof TEXTURES)[number]

interface Renderer {
  gl: WebGL2RenderingContext
  canvas: HTMLCanvasElement
  uPMatrix: WebGLUniformLocation
  uMVMatrix: WebGLUniformLocation
  textures: Record<TextureName, WebGLTexture>
}

let r: Renderer | null = null
let devicePixels: [number, number] = [0, 0]

//scratch matrices, allocated once
const pMatrix = m4.create()
const camera = m4.create()
const tileCamera = m4.create()
const mvMatrix = m4.create()

function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function compileShader(gl: WebGL2RenderingContext, type: GLenum, source: string): WebGLShader {
  const shader = gl.createShader(type) as WebGLShader
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error('Shader compilation error:\n' + gl.getShaderInfoLog(shader))
  }
  return shader
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const program = gl.createProgram()
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource))
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('Could not link shaders:\n' + gl.getProgramInfoLog(program))
  }
  return program
}

//a VAO records which buffer feeds which attribute, so drawing binds one object instead of 4 buffers per cube
function createCubeVAO(gl: WebGL2RenderingContext, program: WebGLProgram): void {
  gl.bindVertexArray(gl.createVertexArray())
  const attribute = (name: string, data: Float32Array, size: number) => {
    const location = gl.getAttribLocation(program, name)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(location)
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0)
  }
  attribute('aVertexPosition', CUBE_POSITIONS, 3)
  attribute('aVertexColor', CUBE_COLORS, 4)
  attribute('aTextureCoord', CUBE_UVS, 2)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, CUBE_INDICES, gl.STATIC_DRAW)
}

async function loadTexture(gl: WebGL2RenderingContext, name: TextureName): Promise<WebGLTexture> {
  const image = new Image()
  image.src = `/projectTextures/${name}.bmp`
  await image.decode()
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.generateMipmap(gl.TEXTURE_2D)
  return texture
}

function applyCanvasSize(): void {
  if (!r) return
  const [width, height] = devicePixels
  r.canvas.width = Math.max(1, Math.round(width / glob.glQuality))
  r.canvas.height = Math.max(1, Math.round(height / glob.glQuality))
}

//the drawing buffer tracks the canvas' size in physical pixels (sharp on HiDPI), capped at 2x and divided by the quality setting
function observeSize(canvas: HTMLCanvasElement): void {
  const capped = () => Math.min(devicePixelRatio, 2) / devicePixelRatio
  const measure = () => {
    devicePixels = [canvas.clientWidth * Math.min(devicePixelRatio, 2), canvas.clientHeight * Math.min(devicePixelRatio, 2)]
  }
  const observer = new ResizeObserver(([entry]) => {
    const box = entry.devicePixelContentBoxSize?.[0]
    if (box) devicePixels = [box.inlineSize * capped(), box.blockSize * capped()]
    else measure()
    applyCanvasSize()
  })
  try {
    observer.observe(canvas, { box: 'device-pixel-content-box' })
  } catch {
    observer.observe(canvas) //Safari has no device-pixel-content-box
  }
  measure()
}

/** Creates the context, program, cube and textures once. Resolves false when WebGL2 is unavailable. */
export async function initRenderer(canvas: HTMLCanvasElement): Promise<boolean> {
  if (r) return true
  const gl = canvas.getContext('webgl2')
  if (!gl) return false
  const program = createProgram(gl)
  gl.useProgram(program)
  createCubeVAO(gl, program)
  const loaded = await Promise.all(TEXTURES.map((name) => loadTexture(gl, name)))
  gl.uniform1i(gl.getUniformLocation(program, 'uSampler'), 0)
  gl.clearColor(0.0, 0.0, 0.0, 0.0) //transparent: the page background shows through
  gl.enable(gl.DEPTH_TEST)
  r = {
    gl,
    canvas,
    uPMatrix: gl.getUniformLocation(program, 'uPMatrix') as WebGLUniformLocation,
    uMVMatrix: gl.getUniformLocation(program, 'uMVMatrix') as WebGLUniformLocation,
    textures: Object.fromEntries(TEXTURES.map((name, i) => [name, loaded[i]])) as Record<TextureName, WebGLTexture>,
  }
  observeSize(canvas)
  return true
}

/** Call when the canvas becomes visible or the quality setting changes. */
export function resizeCanvas(): void {
  if (!r) return
  devicePixels = [r.canvas.clientWidth * Math.min(devicePixelRatio, 2), r.canvas.clientHeight * Math.min(devicePixelRatio, 2)]
  applyCanvasSize()
}

function drawCube(texture: WebGLTexture): void {
  const { gl } = r as Renderer
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.uniformMatrix4fv((r as Renderer).uMVMatrix, false, mvMatrix)
  gl.drawElements(gl.TRIANGLES, CUBE_INDICES.length, gl.UNSIGNED_SHORT, 0)
}

function tileTexture(tile: number, j: number, i: number): WebGLTexture {
  const { textures } = r as Renderer
  const [fx, fy] = glob.finishPos
  if (tile === TILE.END) return textures.end
  if (tile === TILE.START) return textures.start
  if (j + 1 === fx && i === fy) return textures.endL //moving clockwise around finish tile
  if (j + 1 === fx && i + 1 === fy) return textures.endDL
  if (j === fx && i + 1 === fy) return textures.endD
  if (j - 1 === fx && i + 1 === fy) return textures.endDR
  if (j - 1 === fx && i === fy) return textures.endR
  if (j - 1 === fx && i - 1 === fy) return textures.endUR
  if (j === fx && i - 1 === fy) return textures.endU
  if (j + 1 === fx && i - 1 === fy) return textures.endUL
  return textures.block
}

//For every frame this function draws the complete scene from the beginning
export function drawScene(): void {
  const lvl = glob.lvl
  if (!r || !lvl) return
  const { gl } = r
  const g = glob
  const centerY = Math.ceil(lvl.length / 2)
  const centerX = Math.ceil(lvl[0].length / 2)
  const [heroX, heroY] = g.heroPos
  const finishPos = g.finishPos

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  m4.perspective(45, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 100.0, pMatrix)
  gl.uniformMatrix4fv(r.uPMatrix, false, pMatrix)

  //camera, computed once per frame (it used to be rebuilt for every tile)
  m4.identity(camera)
  m4.translate(camera, [0, -(centerY + centerX) / 3.5, -(centerY + centerX) * 1.75])
  m4.rotate(camera, degToRad(g.xTrans * centerX * 8), [0, 1, 0]) //rotations with mouse events
  m4.rotate(camera, degToRad(g.yTrans * centerY * 8), [-1, 0, 0.3])
  //tiles additionally tumble with the intro/lose effects
  m4.set(camera, tileCamera)
  if (g.lostGame > 0) {
    m4.rotate(tileCamera, degToRad(-(100 - g.lostGame) / 4 + Math.pow(100 - g.lostGame, 2) / (20 * 4)), [-0.3, 0.3, 0])
  }
  if (g.newGame > 33) {
    if (g.randEffect === 1 || g.randEffect === 2) {
      m4.translate(tileCamera, [0, 0, -Math.pow(g.newGame - 33, 2) / 50])
    }
    if (g.randEffect === 2 || g.randEffect === 3) {
      m4.rotate(tileCamera, degToRad(((g.newGame - 33) * 360) / 66), [0, 1, 1])
    }
  }
  for (const m of [camera, tileCamera]) {
    m4.translate(m, [0, 0, (centerY + centerX) * 2])
    m4.rotate(m, degToRad(-66), [1, 0, 0])
    m4.rotate(m, degToRad(25), [0, 0, 1])
  }

  //LEVEL
  for (let i = lvl.length; i--; ) {
    const row = lvl[i]
    for (let j = row.length; j--; ) {
      if (row[j] === TILE.EMPTY) continue
      const height = row[j] > 0 && row[j] < TILE.START ? 0.05 + row[j] / 20 : 0.05
      m4.set(tileCamera, mvMatrix)
      if (g.newGame > 0) {
        //Animation for starting the game
        m4.translate(mvMatrix, [
          j + centerX * 0.2,
          -i + centerY * 4,
          -5 + height + Math.max(0, g.newGame - 33) / (Math.log(2 + Math.abs((j - heroX) * (i - heroY))) / Math.LN2),
        ])
        //pseudorandom axis, but static per tile, through three linear congruential generators
        m4.rotate(mvMatrix, degToRad(Math.pow(Math.max(0, g.newGame - 33), 1.5)), [(97 * i + j) % 23, (79 * i + j) % 11, (83 * i + j) % 17])
      } else if (g.wonGame > 0) {
        //Animation for winning the level
        if (row[j] === TILE.END) {
          m4.translate(mvMatrix, [j + centerX * 0.2, -i + centerY * 4, -5 + height + (100 - g.wonGame) / 5 - Math.pow(100 - g.wonGame, 2) / 150])
        } else {
          m4.translate(mvMatrix, [
            j + centerX * 0.2,
            -i + centerY * 4,
            -5 + height - Math.pow(100 - g.wonGame, 2) / ((40 * Math.log(2 + Math.abs((j - heroX) * (i - heroY)))) / Math.LN2),
          ])
        }
        m4.rotate(mvMatrix, degToRad((100 - g.wonGame) * 5), [j - finishPos[0], i - finishPos[1], 1])
      } else if (g.lostGame > 0) {
        //Animation for losing the game
        m4.translate(mvMatrix, [j + centerX * 0.2, -i + centerY * 4, -5 + height + Math.pow(100 - g.lostGame, 2) / 150])
      } else {
        m4.translate(mvMatrix, [j + centerX * 0.2, -i + centerY * 4, -5 + height])
      }
      if (row[j] === TILE.END) {
        //finish tile floats and spins
        m4.translate(mvMatrix, [0, 0, 0.3 + Math.sin(degToRad(g.rCube)) / 6])
        m4.rotate(mvMatrix, degToRad(g.rCube), [Math.sin(degToRad(g.rCube / 2)), Math.sin(degToRad(g.rCube * 4)), Math.sin(degToRad(g.rCube * 2))])
        m4.scale(mvMatrix, [0.35, 0.35, height])
      } else {
        m4.scale(mvMatrix, [0.5, 0.5, height])
      }
      drawCube(tileTexture(row[j], j, i))
    }
  }

  //hero
  m4.set(camera, mvMatrix)
  const animT = MOVE_FRAMES
  const count = g.count === -1 ? animT : g.count
  const { hp, hpp } = g
  const hhp = g.spring ? g.hhp + 0.1 * (count + 1) : g.hhp //add "spring" to step
  if (g.newGame > 0) {
    //Animation for starting the game
    m4.translate(mvMatrix, [
      heroX + g.heroFixPos[0] + centerX * 0.2,
      -heroY + g.heroFixPos[1] + centerY * 4,
      -3.9 + g.heroHeight + g.newGame + 2, //add extra height to smooth transition
    ])
    m4.rotate(mvMatrix, degToRad(g.rotX), [1, 0, 0])
    m4.rotate(mvMatrix, degToRad(g.rotY), [0, 1, 0])
    m4.rotate(mvMatrix, degToRad(g.rotZ), [0, 0, 1])
  } else if (g.wonGame > 0) {
    //Animation for winning the level
    m4.translate(mvMatrix, [
      finishPos[0] + g.heroFixPos[0] + centerX * 0.2,
      -finishPos[1] + g.heroFixPos[1] + centerY * 4,
      -3.9 + g.heroHeight + (100 - g.wonGame) / 3 - Math.pow(100 - g.wonGame, 2) / 150,
    ])
    m4.rotate(mvMatrix, degToRad(Math.pow(100 - g.wonGame, 2) / 20), [finishPos[0] / 2, finishPos[1] / 2, 1])
  } else if (g.lostGame > 0) {
    //Animation for losing the game: hop away from the neighbouring tiles that still exist
    const solid = (x: number, y: number) => (lvl[y]?.[x] ?? TILE.EMPTY) !== TILE.EMPTY
    const distJump = [0, 0]
    for (const d of [1, 2]) {
      if (solid(heroX, heroY + d)) distJump[1] -= 1
      if (solid(heroX, heroY - d)) distJump[1] += 1
      if (solid(heroX + d, heroY)) distJump[0] -= 1
      if (solid(heroX - d, heroY)) distJump[0] += 1
    }
    m4.translate(mvMatrix, [
      (distJump[0] * (100 - g.lostGame)) / 20 + heroX + g.heroFixPos[0] + centerX * 0.2,
      -((distJump[1] * (100 - g.lostGame)) / 20 + heroY) + g.heroFixPos[1] + centerY * 4,
      -3.9 + g.heroHeight - Math.pow(95 - g.lostGame, 2) / 120,
    ])
    m4.rotate(mvMatrix, degToRad((g.rotX * (100 - g.lostGame)) / 15 + (g.rotXprev * g.lostGame) / 100), [1, 0, 0])
    m4.rotate(mvMatrix, degToRad((g.rotY * (100 - g.lostGame)) / 15 + (g.rotYprev * g.lostGame) / 100), [0, 1, 0])
    m4.rotate(mvMatrix, degToRad((g.rotZ * (100 - g.lostGame)) / 15 + (g.rotZprev * g.lostGame) / 100), [0, 0, 1])
    m4.rotate(mvMatrix, degToRad(Math.pow(100 - g.lostGame, 2) / 30), [1, 1, 1])
  } else {
    //rolling, or resting when count === animT
    const t = count / animT
    m4.translate(mvMatrix, [
      hp[0] * t + hpp[0] * (1 - t) + g.heroFixPos[0] * t + g.heroFixPosPrev[0] * (1 - t) + centerX * 0.2,
      -(hp[1] * t + hpp[1] * (1 - t)) + g.heroFixPos[1] * t + g.heroFixPosPrev[1] * (1 - t) + centerY * 4,
      -3.9 + g.heroHeight * t + hhp * (1 - t),
    ])
    m4.rotate(mvMatrix, degToRad(g.rotX * t + g.rotXprev * (1 - t)), [1, 0, 0])
    m4.rotate(mvMatrix, degToRad(g.rotY * t + g.rotYprev * (1 - t)), [0, 1, 0])
    m4.rotate(mvMatrix, degToRad(g.rotZ * t + g.rotZprev * (1 - t)), [0, 0, 1])
  }
  m4.scale(mvMatrix, [0.5, 0.5, 1])
  drawCube(r.textures.hero)
}
