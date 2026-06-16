export class FixedArray {
  constructor(capacity) {
    this.capacity = capacity
    this.length = 0
    this.storage = new Array(capacity).fill(0)
  }

  push(value) {
    if (this.length >= this.capacity) {
      throw new RangeError("FixedArray capacity exceeded")
    }
    this.storage[this.length] = value
    this.length += 1
    return this.length
  }

  get(index) {
    return this.storage[index]
  }

  set(index, value) {
    this.storage[index] = value
  }

  forEach(action) {
    for (let index = 0; index < this.length; index += 1) {
      action(this.storage[index], index)
    }
  }

  clear() {
    this.length = 0
  }
}

export class Pool {
  constructor(capacity) {
    this.capacity = capacity
    this.slots = new Array(capacity).fill(false)
    this.free = []
    for (let index = capacity - 1; index >= 0; index -= 1) {
      this.free.push(index)
    }
  }

  acquire() {
    if (this.free.length === 0) {
      return -1
    }
    const index = this.free.pop()
    this.slots[index] = true
    return index
  }

  release(index) {
    if (index >= 0 && index < this.capacity && this.slots[index]) {
      this.slots[index] = false
      this.free.push(index)
      return true
    }
    return false
  }

  get aliveCount() {
    return this.capacity - this.free.length
  }
}

export class RingBuffer {
  constructor(capacity) {
    this.capacity = capacity
    this.storage = new Array(capacity).fill(0)
    this.head = 0
    this.tail = 0
    this.count = 0
  }

  push(value) {
    if (this.count === this.capacity) {
      this.head = (this.head + 1) % this.capacity
      this.count -= 1
    }
    this.storage[this.tail] = value
    this.tail = (this.tail + 1) % this.capacity
    this.count += 1
  }

  pop() {
    if (this.count === 0) {
      return undefined
    }
    const value = this.storage[this.head]
    this.head = (this.head + 1) % this.capacity
    this.count -= 1
    return value
  }

  get size() {
    return this.count
  }
}

export class BitSet {
  constructor(size) {
    this.size = size
    this.words = new Uint32Array(Math.ceil(size / 32))
  }

  set(index) {
    this.words[index >> 5] |= 1 << (index & 31)
  }

  clear(index) {
    this.words[index >> 5] &= ~(1 << (index & 31))
  }

  has(index) {
    return (this.words[index >> 5] & (1 << (index & 31))) !== 0
  }

  count() {
    let total = 0
    for (const word of this.words) {
      total += popcount(word)
    }
    return total
  }
}

export class Queue {
  constructor(capacity) {
    this.buffer = new RingBuffer(capacity)
  }

  enqueue(value) {
    this.buffer.push(value)
  }

  dequeue() {
    return this.buffer.pop()
  }

  get size() {
    return this.buffer.size
  }
}

function popcount(value) {
  let count = 0
  while (value !== 0) {
    value &= value - 1
    count += 1
  }
  return count
}
