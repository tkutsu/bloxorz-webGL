import { TILE, type HeroPos, type Level, type Vec2 } from './state'

export type Direction = 'up' | 'right' | 'down' | 'left'
const DIRECTIONS: Direction[] = ['up', 'right', 'down', 'left']

//the tile a lying block covers besides its own
const SECOND_CELL: Record<number, Vec2> = { 0: [0, 0], 1: [-1, 0], [-1]: [1, 0], 2: [0, -1], [-2]: [0, 1] }

//heroPos (x , y , {0:standing 1:fallen horiz right -1:fallen horiz left 2:fallen verti down -2:fallen verti up})
export function roll([x, y, o]: HeroPos, dir: Direction): HeroPos {
  //translation 1st integer: if standing, or horiz right, move 2 to the left, else 1 to the left
  //translation 3rd integer: if standing, you are now horiz left, else if horizontal, now standing, else if vertical, you are still vertical
  if (dir === 'left') return [o === 0 || o === 1 ? x - 2 : x - 1, y, o === 0 ? -1 : o === 1 || o === -1 ? 0 : o]
  if (dir === 'up') return [x, o === 0 || o === 2 ? y - 2 : y - 1, o === 0 ? -2 : o === 2 || o === -2 ? 0 : o]
  if (dir === 'right') return [o === 0 || o === -1 ? x + 2 : x + 1, y, o === 0 ? 1 : o === 1 || o === -1 ? 0 : o]
  return [x, o === 0 || o === -2 ? y + 2 : y + 1, o === 0 ? 2 : o === 2 || o === -2 ? 0 : o]
}

function isEmpty(lvl: Level, x: number, y: number): boolean {
  return (lvl[y]?.[x] ?? TILE.EMPTY) === TILE.EMPTY
}

export function isOffBoard(lvl: Level, [x, y, o]: HeroPos): boolean {
  const [dx, dy] = SECOND_CELL[o]
  return isEmpty(lvl, x, y) || isEmpty(lvl, x + dx, y + dy)
}

/** Breadth-first search over every (x, y, orientation) the block can reach from the start tile. */
export function isSolvable(lvl: Level): boolean {
  const width = lvl[0].length
  let start: HeroPos | null = null
  let finish: Vec2 | null = null
  lvl.forEach((row, y) =>
    row.forEach((tile, x) => {
      if (tile === TILE.START) start = [x, y, 0]
      else if (tile === TILE.END) finish = [x, y]
    }),
  )
  if (!start || !finish) return false
  const [fx, fy] = finish as Vec2
  const key = ([x, y, o]: HeroPos) => (y * width + x) * 5 + o + 2
  const seen = new Set([key(start)])
  const queue: HeroPos[] = [start]
  for (let i = 0; i < queue.length; i++) {
    const pos = queue[i]
    if (pos[0] === fx && pos[1] === fy && pos[2] === 0) return true
    for (const dir of DIRECTIONS) {
      const next = roll(pos, dir)
      if (isOffBoard(lvl, next) || seen.has(key(next))) continue
      seen.add(key(next))
      queue.push(next)
    }
  }
  return false
}
