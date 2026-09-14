import vertexShaderSource from './shaders/cube.vert?raw'
import fragmentShaderSource from './shaders/cube.frag?raw'
import { mat3, mat4, vec4 } from 'gl-matrix'
import { CUBE_COLORS, CUBE_INDICES, CUBE_NORMALS, CUBE_POSITIONS, CUBE_UVS } from './cube'
import type { Direction } from './rules'
import { m4 } from './m4'
import { glob, TILE } from './state'
import { MOVE_FRAMES } from './loop'

//layers of projectTextures/tiles.png, a vertical strip of 128×128 images
const LAYER = { block: 0, start: 1, end: 2, hero: 3, endL: 4, endDL: 5, endD: 6, endDR: 7, endR: 8, endUR: 9, endU: 10, endUL: 11 }
const TILE_SIZE = 128
const LAYER_COUNT = 12

//finish-tile halo, indexed by (dy + 1) * 3 + (dx + 1) where dx, dy are the tile's offset from the finish tile
// prettier-ignore
const HALO = [
  LAYER.endDL, LAYER.endD,  LAYER.endDR,
  LAYER.endL,  LAYER.block, LAYER.endR,
  LAYER.endUL, LAYER.endU,  LAYER.endUR,
]

interface Renderer {
  gl: WebGL2RenderingContext
  canvas: HTMLCanvasElement
  uPMatrix: WebGLUniformLocation
  uMVMatrix: WebGLUniformLocation
  uNormalMatrix: WebGLUniformLocation
  uLayer: WebGLUniformLocation
}

let r: Renderer | null = null

//scratch matrices, allocated once
const pMatrix = m4.create()
const camera = m4.create()
const tileCamera = m4.create()
const mvMatrix = m4.create()
const normalMatrix = mat3.create()
const viewProjection = m4.create()
let heroAnchor: [number, number, number] = [0, 0, 0]

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
  attribute('aVertexNormal', CUBE_NORMALS, 3)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, CUBE_INDICES, gl.STATIC_DRAW)
}

async function loadTiles(gl: WebGL2RenderingContext): Promise<void> {
  const image = new Image()
  image.src = '/projectTextures/tiles.png'
  await image.decode()
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, gl.createTexture())
  //an image source is sliced top to bottom into LAYER_COUNT layers of TILE_SIZE × TILE_SIZE
  gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, TILE_SIZE, TILE_SIZE, LAYER_COUNT, 0, gl.RGBA, gl.UNSIGNED_BYTE, image)
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.generateMipmap(gl.TEXTURE_2D_ARRAY)
}

//the drawing buffer follows the canvas' CSS size × devicePixelRatio (sharp on HiDPI, capped at 2x), divided by the quality setting
function observeSize(canvas: HTMLCanvasElement): void {
  new ResizeObserver(resizeCanvas).observe(canvas)
}

/** Creates the context, program, cube and textures once. Resolves false when WebGL2 is unavailable. */
export async function initRenderer(canvas: HTMLCanvasElement): Promise<boolean> {
  if (r) return true
  const gl = canvas.getContext('webgl2')
  if (!gl) return false
  const program = createProgram(gl)
  gl.useProgram(program)
  createCubeVAO(gl, program)
  await loadTiles(gl)
  gl.uniform1i(gl.getUniformLocation(program, 'uTiles'), 0)
  gl.clearColor(0.0, 0.0, 0.0, 0.0) //transparent: the page background shows through
  gl.enable(gl.DEPTH_TEST)
  r = {
    gl,
    canvas,
    uPMatrix: gl.getUniformLocation(program, 'uPMatrix') as WebGLUniformLocation,
    uMVMatrix: gl.getUniformLocation(program, 'uMVMatrix') as WebGLUniformLocation,
    uNormalMatrix: gl.getUniformLocation(program, 'uNormalMatrix') as WebGLUniformLocation,
    uLayer: gl.getUniformLocation(program, 'uLayer') as WebGLUniformLocation,
  }
  observeSize(canvas)
  return true
}

/** Also called when the canvas becomes visible or the quality setting changes. */
export function resizeCanvas(): void {
  if (!r) return
  const scale = Math.min(devicePixelRatio, 2) / glob.glQuality
  r.canvas.width = Math.max(1, Math.round(r.canvas.clientWidth * scale))
  r.canvas.height = Math.max(1, Math.round(r.canvas.clientHeight * scale))
}

function drawCube(layer: number): void {
  const { gl, uMVMatrix, uNormalMatrix, uLayer } = r as Renderer
  gl.uniform1i(uLayer, layer)
  gl.uniformMatrix4fv(uMVMatrix, false, mvMatrix)
  gl.uniformMatrix3fv(uNormalMatrix, false, mat3.normalFromMat4(normalMatrix, mvMatrix))
  gl.drawElements(gl.TRIANGLES, CUBE_INDICES.length, gl.UNSIGNED_SHORT, 0)
}

function tileLayer(tile: number, j: number, i: number): number {
  if (tile === TILE.END) return LAYER.end
  if (tile === TILE.START) return LAYER.start
  const dx = j - glob.finishPos[0]
  const dy = i - glob.finishPos[1]
  return Math.abs(dx) <= 1 && Math.abs(dy) <= 1 ? HALO[(dy + 1) * 3 + (dx + 1)] : LAYER.block
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
  const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight
  //45° was tuned on landscape monitors; on portrait screens keep 45° horizontally instead, or the board is cut off at the sides
  const fovY = aspect >= 1 ? 45 : (2 * Math.atan(Math.tan(degToRad(22.5)) / aspect) * 180) / Math.PI
  m4.perspective(fovY, aspect, 0.1, 100.0, pMatrix)
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

  mat4.multiply(viewProjection, pMatrix, camera)
  heroAnchor = [heroX + centerX * 0.2, -heroY + centerY * 4, -3.9]

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
      drawCube(tileLayer(row[j], j, i))
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
  drawCube(LAYER.hero)
}

/**
 * Which roll a swipe means. The grid is drawn rotated and the player can orbit the camera, so screen "up"
 * is not grid "up": project the block's four neighbours through the last frame's camera and pick the one
 * whose on-screen direction is closest to the swipe.
 */
export function directionOnScreen(dx: number, dy: number): Direction {
  const toScreen = (x: number, y: number, z: number): [number, number] => {
    const v = vec4.transformMat4(vec4.create(), [x, y, z, 1], viewProjection)
    return [v[0] / v[3], -v[1] / v[3]] //NDC, with y pointing down like screen pixels
  }
  const [ax, ay, az] = heroAnchor
  const origin = toScreen(ax, ay, az)
  const aspect = r ? r.gl.drawingBufferWidth / r.gl.drawingBufferHeight : 1
  //grid x+1 is world x+1, grid y+1 is world y-1
  const neighbours: [Direction, number, number][] = [['right', 1, 0], ['left', -1, 0], ['down', 0, -1], ['up', 0, 1]]
  let best: Direction = 'up'
  let bestCos = -Infinity
  for (const [direction, wx, wy] of neighbours) {
    const p = toScreen(ax + wx, ay + wy, az)
    const sx = (p[0] - origin[0]) * aspect
    const sy = p[1] - origin[1]
    const cos = (sx * dx + sy * dy) / (Math.hypot(sx, sy) * Math.hypot(dx, dy))
    if (cos > bestCos) {
      bestCos = cos
      best = direction
    }
  }
  return best
}

