import test from "node:test"
import assert from "node:assert/strict"
import zlib from "node:zlib"

import { compileSpriteAsset } from "../src/asset_compiler.js"

function encodePng({ width, height, pixels }) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let channel = 0; channel < 4; channel += 1) {
        raw[y * (stride + 1) + 1 + x * 4 + channel] = pixels[(y * width + x) * 4 + channel]
      }
    }
  }
  const idat = zlib.deflateSync(raw)
  const body = (type, data) => {
    const header = Buffer.alloc(8)
    header.writeUInt32BE(data.length, 0)
    header.write(type, 4, "ascii")
    return Buffer.concat([header, data, Buffer.alloc(4)])
  }
  return Buffer.concat([signature, body("IHDR", ihdr), body("IDAT", idat), body("IEND", Buffer.alloc(0))])
}

test("compiles a sprite PNG into tiles, palette and VRAM bytes", () => {
  const pixels = new Uint8Array(8 * 8 * 4)
  for (let index = 0; index < 64; index += 1) {
    pixels[index * 4] = index % 4 === 0 ? 255 : 0
    pixels[index * 4 + 1] = index % 4 === 1 ? 255 : 0
    pixels[index * 4 + 2] = index % 4 === 2 ? 255 : 0
    pixels[index * 4 + 3] = 255
  }
  const asset = compileSpriteAsset("player", encodePng({ width: 8, height: 8, pixels }))

  assert.equal(asset.name, "player")
  assert.equal(asset.width, 8)
  assert.equal(asset.tiles.length, 1)
  assert.equal(asset.palette.length, 4)
  assert.equal(asset.vramBytes, 32)
  assert.equal(asset.tiles[0].bitplanes.length, 32)
})

test("deduplicates identical tiles and reports unique count", () => {
  const pixels = new Uint8Array(16 * 8 * 4)
  for (let index = 0; index < 128; index += 1) {
    pixels[index * 4] = 255
    pixels[index * 4 + 3] = 255
  }
  const asset = compileSpriteAsset("solid", encodePng({ width: 16, height: 8, pixels }))

  assert.equal(asset.tiles.length, 2)
  assert.equal(asset.uniqueCount, 1)
  assert.equal(asset.vramBytes, 32)
})

test("measures palette quantization error", () => {
  const pixels = new Uint8Array(8 * 8 * 4)
  for (let index = 0; index < 64; index += 1) {
    pixels[index * 4] = index * 4
    pixels[index * 4 + 1] = 128
    pixels[index * 4 + 2] = 64
    pixels[index * 4 + 3] = 255
  }
  const asset = compileSpriteAsset("gradient", encodePng({ width: 8, height: 8, pixels }))
  assert.ok(asset.deltaE.max >= 0)
  assert.ok(asset.palette.length <= 16)
})
