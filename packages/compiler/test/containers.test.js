import test from "node:test"
import assert from "node:assert/strict"

import { FixedArray, Pool, RingBuffer, BitSet, Queue } from "../src/containers.js"

test("FixedArray enforces its capacity", () => {
  const array = new FixedArray(2)
  array.push(10)
  array.push(20)
  assert.throws(() => array.push(30), /capacity/)
  assert.equal(array.get(1), 20)
})

test("FixedArray iterates only over live slots", () => {
  const array = new FixedArray(4)
  array.push(1)
  array.push(2)
  const seen = []
  array.forEach(value => seen.push(value))
  assert.deepEqual(seen, [1, 2])
})

test("Pool hands out and reclaims slots", () => {
  const pool = new Pool(3)
  const first = pool.acquire()
  const second = pool.acquire()
  assert.notEqual(first, second)
  assert.equal(pool.aliveCount, 2)
  assert.equal(pool.release(first), true)
  assert.equal(pool.aliveCount, 1)
  assert.equal(pool.release(first), false)
})

test("Pool reports exhaustion", () => {
  const pool = new Pool(2)
  pool.acquire()
  pool.acquire()
  assert.equal(pool.acquire(), -1)
})

test("RingBuffer overwrites the oldest entry when full", () => {
  const ring = new RingBuffer(3)
  ring.push(1)
  ring.push(2)
  ring.push(3)
  ring.push(4)
  assert.equal(ring.size, 3)
  assert.equal(ring.pop(), 2)
})

test("RingBuffer pops in FIFO order", () => {
  const ring = new RingBuffer(4)
  ring.push("a")
  ring.push("b")
  assert.equal(ring.pop(), "a")
  assert.equal(ring.pop(), "b")
  assert.equal(ring.pop(), undefined)
})

test("BitSet sets, clears and counts bits", () => {
  const bits = new BitSet(64)
  assert.equal(bits.has(0), false)
  bits.set(0)
  bits.set(33)
  assert.equal(bits.has(0), true)
  assert.equal(bits.has(33), true)
  assert.equal(bits.count(), 2)
  bits.clear(0)
  assert.equal(bits.count(), 1)
})

test("Queue provides FIFO semantics over a ring buffer", () => {
  const queue = new Queue(3)
  queue.enqueue(1)
  queue.enqueue(2)
  assert.equal(queue.dequeue(), 1)
  queue.enqueue(3)
  assert.equal(queue.dequeue(), 2)
  assert.equal(queue.dequeue(), 3)
})
