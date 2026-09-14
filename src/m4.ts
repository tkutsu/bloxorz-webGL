import { mat4, type ReadonlyVec3 } from 'gl-matrix'

//glMatrix 0.9.5 call shapes on top of gl-matrix 3: matrix first and mutated in place, perspective in degrees
export const m4 = {
  create: (): mat4 => mat4.create(),
  identity: (m: mat4) => mat4.identity(m),
  set: (src: mat4, dest: mat4) => mat4.copy(dest, src),
  translate: (m: mat4, v: ReadonlyVec3) => mat4.translate(m, m, v),
  rotate: (m: mat4, rad: number, axis: ReadonlyVec3) => mat4.rotate(m, m, rad, axis),
  scale: (m: mat4, v: ReadonlyVec3) => mat4.scale(m, m, v),
  perspective: (fovDegrees: number, aspect: number, near: number, far: number, out: mat4) =>
    mat4.perspective(out, (fovDegrees * Math.PI) / 180, aspect, near, far),
}
