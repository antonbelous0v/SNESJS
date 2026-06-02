import { performance } from "node:perf_hooks"

import { collectUniqueColors, quantizePalette } from "../src/palette.js"

const count = Number(process.argv[2] ?? 1000000)
const pixels = generatePixels(count)

measure("color collection", 10, () => collectUniqueColors(pixels))
measure("palette quantize", 100, () => {
  const colors = []
  for (let index = 0; index < 256; index += 1) {
    colors.push({ red: index, green: index % 64, blue: (index * 3) % 256 })
  }
  return quantizePalette(colors)
})

function generatePixels(amount) {
  const pixels = new Uint8Array(amount)
  for (let index = 0; index < amount; index += 1) {
    pixels[index] = (index * 31) & 0xff
  }
  return pixels
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
  console.log(`${name.padEnd(18)} ${iterations.toString().padStart(4)} runs ${milliseconds.toFixed(2).padStart(9)} ms`)
}
