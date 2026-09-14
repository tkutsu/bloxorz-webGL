export type Vec2 = [number, number]
/** [x, y, orientation] — orientation 0: standing, 1/-1: lying along x, 2/-2: lying along y */
export type HeroPos = [number, number, number]
/** Rows of tiles: TILE values, or any other number = tile height */
export type Level = number[][]

export const TILE = { EMPTY: -99, START: 98, END: 99 } as const

export const glob = {
  canvas: null as HTMLCanvasElement | null,
  glQuality: 1, //higher numbers = lower resolution, better performance
  rCube: 0, //finish cube spin, in degrees
  xTrans: 0, //camera drag offsets
  yTrans: 0,

  lvl: null as Level | null,
  finishPos: [0, 0] as Vec2,
  heroPos: [0, 0, 0] as HeroPos, //where the block last came to rest
  hp: [0, 0, 0] as HeroPos, //target of the move being animated
  hpp: [0, 0, 0] as HeroPos, //origin of the move being animated
  count: -1, //move progress in 60 Hz frames (0..MOVE_FRAMES), -1 when idle
  spring: false, //true while rolling (adds the hop), false while settling after the drop-in
  hhp: 0, //height the current move starts from
  heroHeight: 0,
  heroFixPos: [0, 0] as Vec2, //offset of the block's centre from its tile, per orientation
  heroFixPosPrev: [0, 0] as Vec2,
  rotX: 0,
  rotXprev: 0,
  rotY: 0,
  rotYprev: 0,
  rotZ: 0,
  rotZprev: 0,

  //countdowns from 100 to 0 in 60 Hz frames, -1 when not running
  newGame: -1,
  wonGame: -1,
  lostGame: -1,

  runSeed: 0, //every level of a run derives from this, shared as ?seed=
  level: 0, //levels completed in this run
  score: 0,
  topScoreShown: false,
  startTime: null as number | null, //for the FAST! bonus
  randEffect: 0, //level intro/outro animation variant, 0..3
}
