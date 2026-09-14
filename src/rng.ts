/** mulberry32: the same 32-bit seed always yields the same stream of floats in [0, 1) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}

//base 36 keeps shared links short: the largest 32-bit seed is 7 characters
export function seedToString(seed: number): string {
  return seed.toString(36)
}

export function parseSeed(text: string | null): number | null {
  if (!text || !/^[0-9a-z]{1,7}$/i.test(text)) return null
  const seed = parseInt(text, 36)
  return seed <= 0xffffffff ? seed : null
}
