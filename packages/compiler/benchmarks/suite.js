import { performance } from "node:perf_hooks"

import { compile } from "../src/compile.js"
import { generateC } from "../src/codegen.js"
import { TileDeduplicator, Tile } from "../src/tiles.js"
import { collectUniqueColors, quantizePalette } from "../src/palette.js"

const source = generateGameSource(300)
const tiles = generateTiles(50000)
const pixels = generatePixels(400000)

const results = []
measure("compile pipeline", 20, () => {
  const result = compile(source)
  if (result.hasErrors) {
    throw new Error("benchmark source failed to compile")
  }
  generateC(result.ast)
})
measure("tile dedup", 5, () => {
  const deduplicator = new TileDeduplicator()
  for (const tile of tiles) {
    deduplicator.index(tile)
  }
})
measure("palette quantize", 50, () => {
  const colors = collectUniqueColors(pixels)
  quantizePalette(colors)
})

console.log("SNESJS benchmark suite")
console.log("")
for (const result of results) {
  console.log(`${result.name.padEnd(18)} ${result.operations.toString().padStart(5)} runs ${result.milliseconds.toFixed(2).padStart(9)} ms ${result.rate.toFixed(0).padStart(10)} ops/s`)
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
  results.push({ name, operations: iterations, milliseconds, rate: iterations / (milliseconds / 1000) })
}

function generateGameSource(statementCount) {
  const statements = [
    `import { Game, Scene, Sprite, Input } from "snes"`,
    `let playerX = 120`,
    `let enemy = { velocity: { x: 0 } }`,
    `let particles = [0, 1, 2, 3]`,
    `class Enemy { constructor(x, y) { this.x = x; this.hp = 3 } update() { this.x -= 1 } }`,
  ]
  for (let index = 0; index < statementCount; index += 1) {
    statements.push(`if (Input.pressed("A") && playerX > ${index % 20}) { playerX -= ${index % 8} }`)
    statements.push(`enemy.velocity.x = Input.axis("horizontal") * 2 + Mathx.sin(${index % 256})`)
    statements.push(`for (let i = 0; i < ${index % 16}; i++) { particles[i].x += i }`)
  }
  return statements.join("\n")
}

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

function generatePixels(amount) {
  const pixels = new Uint8Array(amount)
  for (let index = 0; index < amount; index += 1) {
    pixels[index] = (index * 31) & 0xff
  }
  return pixels
}
