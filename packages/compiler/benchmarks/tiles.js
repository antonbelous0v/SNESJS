import { performance } from "node:perf_hooks"

import { Tile, TileDeduplicator } from "../src/tiles.js"

const count = Number(process.argv[2] ?? 100000)
const tiles = generateTiles(count)

measure("tile dedup", 5, () => {
  const deduplicator = new TileDeduplicator()
  for (const tile of tiles) {
    deduplicator.index(tile)
  }
})

function generateTiles(amount) {
  const tiles = new Array(amount)
  for (let index = 0; index < amount; index += 1) {
    const rows = new Array(8)
    for (let row = 0; row < 8; row += 1) {
      rows[row] = (index * 2654435761 + row * 97) & 0xff
    }
    tiles[index] = new Tile(rows)
  }
  return tiles
}

function measure(name, iterations, action) {
  for (let index = 0; index < 2; index += 1) {
    action()
  }
  const start = performance.now()
  for (let index = 0; index < iterations; index += 1) {
    action()
  }
  const milliseconds = performance.now() - start
  const rate = count * iterations / (milliseconds / 1000)
  console.log(`${name.padEnd(12)} ${count.toString().padStart(7)} tiles ${iterations} runs ${milliseconds.toFixed(2).padStart(9)} ms ${Math.round(rate).toString().padStart(9)} tiles/s`)
}
