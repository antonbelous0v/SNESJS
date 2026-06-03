export const FIXED_SCALE = 256

export function fixed(value) {
  return Math.round(value * FIXED_SCALE)
}

export function toFloat(value) {
  return value / FIXED_SCALE
}

export function mulFixed(a, b) {
  return Math.round((a * b) / FIXED_SCALE)
}

export function divFixed(a, b) {
  if (b === 0) {
    return 0
  }
  return Math.round(a * FIXED_SCALE / b)
}

export function lerp(a, b, t) {
  return a + Math.round((b - a) * t)
}

export class TrigTable {
  constructor(size = 256) {
    this.size = size
    this.sine = new Int16Array(size)
    for (let index = 0; index < size; index += 1) {
      const radians = index / size * Math.PI * 2
      this.sine[index] = Math.round(Math.sin(radians) * 127)
    }
  }

  sin(angle) {
    return this.sine[angle & (this.size - 1)]
  }

  cos(angle) {
    return this.sine[(angle + this.size / 4) & (this.size - 1)]
  }
}

export class DeterministicRandom {
  constructor(seed = 0x12345678) {
    this.state = seed >>> 0
  }

  next() {
    let value = this.state
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    this.state = value >>> 0
    return this.state
  }

  int(min, max) {
    const range = max - min
    return min + (this.next() % range)
  }

  range(min, max) {
    return this.int(min, max + 1)
  }

  float() {
    return this.next() / 0xffffffff
  }
}

const sharedTrig = new TrigTable(256)

export const Mathx = Object.freeze({
  fixed,
  toFloat,
  mul: mulFixed,
  div: divFixed,
  lerp,
  sin: angle => sharedTrig.sin(Math.round(angle / (Math.PI * 2) * 256)),
  cos: angle => sharedTrig.cos(Math.round(angle / (Math.PI * 2) * 256)),
})

export const Trig = Object.freeze({
  sin8: angle => sharedTrig.sin(angle),
  cos8: angle => sharedTrig.cos(angle),
})
