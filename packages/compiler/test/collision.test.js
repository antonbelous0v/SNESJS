import test from "node:test"
import assert from "node:assert/strict"

import { Aabb, aabbOverlap, pointInAabb, GridBroadphase, TileCollision } from "../src/collision.js"

test("AABB overlap detects intersections", () => {
  const a = new Aabb(0, 0, 10, 10)
  const b = new Aabb(5, 5, 10, 10)
  const c = new Aabb(20, 20, 10, 10)
  assert.equal(a.overlaps(b), true)
  assert.equal(aabbOverlap(a, c), false)
})

test("AABB edges do not count as overlap", () => {
  const a = new Aabb(0, 0, 10, 10)
  const b = new Aabb(10, 0, 10, 10)
  assert.equal(a.overlaps(b), false)
})

test("point-in-AABB respects half-open bounds", () => {
  const aabb = new Aabb(0, 0, 10, 10)
  assert.equal(pointInAabb(aabb, 5, 5), true)
  assert.equal(pointInAabb(aabb, 10, 5), false)
})

test("grid broadphase inserts and queries bodies", () => {
  const grid = new GridBroadphase(32, 16)
  grid.insert(0, new Aabb(0, 0, 8, 8))
  grid.insert(1, new Aabb(64, 64, 8, 8))
  grid.insert(2, new Aabb(4, 4, 8, 8))

  const near = grid.query(new Aabb(0, 0, 16, 16))
  assert.deepEqual(near.sort(), [0, 2])
})

test("grid broadphase finds overlapping pairs without duplicates", () => {
  const grid = new GridBroadphase(32, 16)
  grid.insert(0, new Aabb(0, 0, 8, 8))
  grid.insert(1, new Aabb(4, 4, 8, 8))
  grid.insert(2, new Aabb(100, 100, 8, 8))

  const pairs = grid.queryPairwise()
  assert.equal(pairs.length, 1)
  assert.deepEqual(pairs[0], [0, 1])
})

test("tile collision walks a solid tile grid", () => {
  const tiles = [
    [1, 1, 0, 0],
    [1, 1, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]
  const collision = new TileCollision(tiles, 8)
  assert.equal(collision.collides(new Aabb(0, 0, 8, 8)), true)
  assert.equal(collision.collides(new Aabb(16, 16, 8, 8)), false)
  assert.equal(collision.collides(new Aabb(-8, 0, 8, 8)), true)
})
