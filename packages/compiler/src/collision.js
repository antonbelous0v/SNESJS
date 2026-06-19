export class Aabb {
  constructor(x, y, width, height) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
  }

  get left() {
    return this.x
  }

  get right() {
    return this.x + this.width
  }

  get top() {
    return this.y
  }

  get bottom() {
    return this.y + this.height
  }

  overlaps(other) {
    return this.left < other.right && this.right > other.left && this.top < other.bottom && this.bottom > other.top
  }

  contains(x, y) {
    return x >= this.left && x < this.right && y >= this.top && y < this.bottom
  }
}

export function aabbOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

export function pointInAabb(aabb, x, y) {
  return x >= aabb.left && x < aabb.right && y >= aabb.top && y < aabb.bottom
}

export class GridBroadphase {
  constructor(cellSize, maxBodies) {
    this.cellSize = cellSize
    this.maxBodies = maxBodies
    this.cells = new Map()
    this.bodies = new Array(maxBodies)
    this.bodyCount = 0
  }

  insert(id, aabb) {
    this.bodies[this.bodyCount] = { id, aabb }
    this.bodyCount += 1
    for (const key of this.cellsFor(aabb)) {
      if (!this.cells.has(key)) {
        this.cells.set(key, [])
      }
      this.cells.get(key).push(id)
    }
  }

  clear() {
    this.cells.clear()
    this.bodyCount = 0
  }

  query(aabb) {
    const matches = new Set()
    for (const key of this.cellsFor(aabb)) {
      const ids = this.cells.get(key)
      if (ids) {
        for (const id of ids) {
          matches.add(id)
        }
      }
    }
    return [...matches]
  }

  queryPairwise() {
    const pairs = []
    for (let index = 0; index < this.bodyCount; index += 1) {
      const body = this.bodies[index]
      const candidates = this.query(body.aabb)
      for (const otherId of candidates) {
        if (otherId <= body.id) {
          continue
        }
        const other = this.bodies.find(candidate => candidate.id === otherId)
        if (other && aabbOverlap(body.aabb, other.aabb)) {
          pairs.push([body.id, otherId])
        }
      }
    }
    return pairs
  }

  cellsFor(aabb) {
    const minX = Math.floor(aabb.left / this.cellSize)
    const maxX = Math.floor((aabb.right - 1) / this.cellSize)
    const minY = Math.floor(aabb.top / this.cellSize)
    const maxY = Math.floor((aabb.bottom - 1) / this.cellSize)
    const keys = []
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        keys.push(`${x},${y}`)
      }
    }
    return keys
  }
}

export class TileCollision {
  constructor(tiles, tileSize) {
    this.tiles = tiles
    this.tileSize = tileSize
  }

  solidAt(tileX, tileY) {
    if (tileX < 0 || tileY < 0 || tileX >= this.tiles[0].length || tileY >= this.tiles.length) {
      return true
    }
    return this.tiles[tileY][tileX] !== 0
  }

  collides(aabb) {
    const minX = Math.floor(aabb.left / this.tileSize)
    const maxX = Math.floor((aabb.right - 1) / this.tileSize)
    const minY = Math.floor(aabb.top / this.tileSize)
    const maxY = Math.floor((aabb.bottom - 1) / this.tileSize)
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (this.solidAt(x, y)) {
          return true
        }
      }
    }
    return false
  }
}
