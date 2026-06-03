import test from "node:test"
import assert from "node:assert/strict"
import zlib from "node:zlib"

import { decodePng } from "../src/png.js"

function encodePng({ width, height, pixels, colorType = 6 }) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = colorType
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1
  const stride = width * channels
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0
    for (let x = 0; x < width; x += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        raw[y * (stride + 1) + 1 + x * channels + channel] = pixels[(y * width + x) * 4 + channel]
      }
    }
  }
  const idat = zlib.deflateSync(raw)
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

function chunk(type, data) {
  const header = Buffer.alloc(8)
  header.writeUInt32BE(data.length, 0)
  header.write(type, 4, "ascii")
  const crc = Buffer.alloc(4)
  const body = Buffer.concat([Buffer.from(type, "ascii"), data])
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([header, data, crc])
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

test("decodes an RGBA PNG", () => {
  const pixels = new Uint8Array(2 * 2 * 4)
  pixels.set([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255])
  const png = encodePng({ width: 2, height: 2, pixels })
  const decoded = decodePng(png)

  assert.equal(decoded.width, 2)
  assert.equal(decoded.height, 2)
  assert.deepEqual([...decoded.pixels], [...pixels])
})

test("decodes an RGB PNG without alpha", () => {
  const pixels = new Uint8Array(1 * 1 * 4)
  pixels.set([10, 20, 30, 255])
  const png = encodePng({ width: 1, height: 1, pixels, colorType: 2 })
  const decoded = decodePng(png)

  assert.equal(decoded.pixels[0], 10)
  assert.equal(decoded.pixels[1], 20)
  assert.equal(decoded.pixels[2], 30)
  assert.equal(decoded.pixels[3], 255)
})

test("rejects data without a PNG signature", () => {
  assert.throws(() => decodePng(Buffer.from([0, 1, 2, 3])), /signature mismatch/)
})
