export class Tile {
  constructor(rows, kind = "plain") {
    this.rows = rows
    this.kind = kind
  }

  static fromRows(rows) {
    return new Tile(rows)
  }

  get key() {
    return this.rows.join("|")
  }

  flippedHorizontal() {
    return new Tile(this.rows.map(row => reverseBits(row, 8)), "h")
  }

  flippedVertical() {
    return new Tile([...this.rows].reverse(), "v")
  }

  flippedBoth() {
    return new Tile([...this.rows].reverse().map(row => reverseBits(row, 8)), "hv")
  }
}

export function reverseBits(value, bits) {
  let result = 0
  for (let index = 0; index < bits; index += 1) {
    result = (result << 1) | (value & 1)
    value >>>= 1
  }
  return result >>> 0
}

export class TileDeduplicator {
  constructor() {
    this.unique = new Map()
  }

  deduplicate(tiles) {
    const results = []
    for (const tile of tiles) {
      results.push(this.index(tile))
    }
    return {
      uniqueTiles: [...this.unique.keys()],
      results,
      originalCount: tiles.length,
      uniqueCount: this.unique.size,
    }
  }

  index(tile) {
    const variants = [
      { kind: "plain", tile },
      { kind: "h", tile: tile.flippedHorizontal() },
      { kind: "v", tile: tile.flippedVertical() },
      { kind: "hv", tile: tile.flippedBoth() },
    ]
    for (const { kind, tile: variant } of variants) {
      const key = variant.key
      if (this.unique.has(key)) {
        return { index: this.unique.get(key), flip: kind }
      }
    }
    const index = this.unique.size
    this.unique.set(tile.key, index)
    return { index, flip: "plain" }
  }
}

export function deduplicateTiles(tiles) {
  return new TileDeduplicator().deduplicate(tiles)
}

export function tileBytes(uniqueCount) {
  return uniqueCount * 32
}

export function savedBytes(originalCount, uniqueCount) {
  return (originalCount - uniqueCount) * 32
}
