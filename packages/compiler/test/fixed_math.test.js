import test from "node:test"
import assert from "node:assert/strict"

import { fixed, toFloat, mulFixed, divFixed, lerp, TrigTable, DeterministicRandom, Mathx, Trig } from "../src/fixed_math.js"

test("converts between floating point and fixed point", () => {
  assert.equal(fixed(1.25), 320)
  assert.equal(toFloat(320), 1.25)
  assert.equal(fixed(0.5), 128)
})

test("multiplies and divides in fixed point", () => {
  assert.equal(mulFixed(fixed(1.5), fixed(2)), fixed(3))
  assert.equal(divFixed(fixed(3), fixed(2)), fixed(1.5))
})

test("lerps between fixed point values", () => {
  assert.equal(lerp(fixed(0), fixed(100), 0.25), fixed(25))
  assert.equal(lerp(0, 256, 0.5), 128)
})

test("builds a sine lookup table with byte angles", () => {
  const table = new TrigTable(256)
  assert.equal(table.sin(0), 0)
  assert.equal(table.sin(64), 127)
  assert.equal(table.cos(0), 127)
  assert.equal(table.sin(256 + 64), 127)
})

test("Mathx wraps the trig table with radian input", () => {
  assert.equal(Mathx.sin(0), 0)
  assert.equal(Mathx.cos(0), 127)
})

test("deterministic RNG reproduces sequences from a seed", () => {
  const first = new DeterministicRandom(42)
  const second = new DeterministicRandom(42)
  for (let index = 0; index < 100; index += 1) {
    assert.equal(first.next(), second.next())
  }
})

test("RNG helpers stay within their requested ranges", () => {
  const random = new DeterministicRandom(7)
  for (let index = 0; index < 1000; index += 1) {
    const value = random.int(0, 10)
    assert.ok(value >= 0 && value < 10)
  }
})
