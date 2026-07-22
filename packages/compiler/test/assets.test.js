import test from "node:test"
import assert from "node:assert/strict"

import { rgb555, unpack555, collectUniqueColors, quantizePalette, groupSharedPalette, paletteDeltaE, colorError } from "../src/palette.js"
import { BitmapImage, extractTiles, indicesToBitplanes } from "../src/bitmap.js"

test("packs and unpacks 15-bit SNES colors", () => {
  const value = rgb555(255, 0, 0)
  assert.equal(value, 0x1f)
  const unpacked = unpack555(0x1f)
  assert.equal(unpacked[0], 255)
  assert.equal(unpacked[1], 0)
  assert.equal(unpacked[2], 0)

  const white = rgb555(255, 255, 255)
  assert.equal(white, 0x7fff)
})

test("collects unique colors from RGBA pixel buffers", () => {
  const pixels = [255, 0, 0, 255, 0, 255, 0, 255, 255, 0, 0, 255]
  const colors = collectUniqueColors(pixels)
  assert.equal(colors.length, 2)
  assert.equal(colors[0].count, 2)
})

test("quantizes palettes to at most 16 colors", () => {
  const colors = []
  for (let index = 0; index < 30; index += 1) {
    colors.push({ red: index * 8, green: 0, blue: 0 })
  }
  const palette = quantizePalette(colors)
  assert.equal(palette.length, 16)
})

test("merges shared palettes across grouped sprites", () => {
  const group = [
    { colors: [{ red: 255, green: 0, blue: 0 }, { red: 0, green: 255, blue: 0 }] },
    { colors: [{ red: 255, green: 0, blue: 0 }, { red: 0, green: 0, blue: 255 }] },
  ]
  const merged = groupSharedPalette(group)
  assert.equal(merged.length, 3)
})

test("measures color quantization error", () => {
  const error = colorError([255, 0, 0], rgb555(255, 0, 0))
  assert.equal(error, 0)

  const approximate = paletteDeltaE([{ red: 128, green: 128, blue: 128 }])
  assert.ok(approximate.max < 10)
})

test("extracts 8x8 tiles from an image", () => {
  const pixels = new Array(16 * 8 * 4).fill(0)
  const image = new BitmapImage({ width: 16, height: 8, pixels })
  const tiles = extractTiles(image)
  assert.equal(tiles.length, 2)
  assert.equal(tiles[0].pixels.length, 64)
})

test("encodes palette indices as 4bpp bitplanes", () => {
  const indices = new Array(64).fill(0)
  indices[0] = 0b1010
  const rows = indicesToBitplanes(indices)
  assert.equal(rows.length, 32)
  assert.equal(rows[0], 0b00000000)
  assert.equal(rows[1], 0b10000000)
  assert.equal(rows[16], 0b00000000)
  assert.equal(rows[17], 0b10000000)
})
