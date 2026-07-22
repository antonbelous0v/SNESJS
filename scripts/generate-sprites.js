import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"

const OUT = path.resolve(new URL("..", import.meta.url).pathname, "examples/slime-knight/assets")

const PALETTE = {
  ".": [0, 0, 0, 0],
  "O": [20, 20, 40, 255],
  "S": [200, 205, 215, 255],
  "Y": [255, 210, 63, 255],
  "B": [58, 110, 165, 255],
  "D": [40, 78, 120, 255],
  "R": [214, 69, 69, 255],
  "G": [76, 175, 80, 255],
  "L": [139, 195, 74, 255],
  "E": [122, 82, 48, 255],
  "M": [92, 58, 30, 255],
  "W": [245, 245, 245, 255],
  "K": [15, 15, 15, 255],
  "P": [255, 150, 180, 255],
}

const KNIGHT_IDLE = [
  "................",
  "................",
  ".....OOOOOO.....",
  "....OSSSSSSO....",
  "....OSSSSSSO....",
  "....OSSYYSSO....",
  "....OSSSSSSO....",
  ".....OBBBBO.....",
  "...OOBBBBBBOO...",
  "..OBBBBBBBBBBO..",
  "..OBBBBBBBBBBO..",
  "..OBBRRBBRRBBO..",
  "...OBBBBBBBBO...",
  "....OBBOOBBO....",
  "....OBB..BBO....",
  "...OOOO..OOOO...",
]

const KNIGHT_WALK1 = [
  "................",
  "................",
  ".....OOOOOO.....",
  "....OSSSSSSO....",
  "....OSSSSSSO....",
  "....OSSYYSSO....",
  "....OSSSSSSO....",
  ".....OBBBBO.....",
  "...OOBBBBBBOO...",
  "..OBBBBBBBBBBO..",
  "..OBBBBBBBBBBO..",
  "..OBBRRBBRRBBO..",
  "...OBBBBBBBBO...",
  "....OBBOOBBO....",
  "...OBB....BBO...",
  "...OOO....OOO...",
]

const KNIGHT_WALK2 = [
  "................",
  "................",
  ".....OOOOOO.....",
  "....OSSSSSSO....",
  "....OSSSSSSO....",
  "....OSSYYSSO....",
  "....OSSSSSSO....",
  ".....OBBBBO.....",
  "...OOBBBBBBOO...",
  "..OBBBBBBBBBBO..",
  "..OBBBBBBBBBBO..",
  "..OBBRRBBRRBBO..",
  "...OBBBBBBBBO...",
  "....OBBOOBBO....",
  "....OBB..BBO....",
  "...OOOO..OOOO...",
]

const SLIME_A = [
  "................",
  "................",
  "................",
  ".....OOOOOO.....",
  "....OGGGGGGO....",
  "...OGGGGGGGGO...",
  "...OGLGGGGGGO...",
  "..OGGGGGGGGGGO..",
  "..OGGGGGGGGGGO..",
  "..OGGKWWGGWWGO..",
  "..OGGKKGGKKGOO..",
  ".OGGGGGGGGGGGGO.",
  ".OGGGGGGGGGGGGO.",
  ".OGGGGGGGGGGGGO.",
  ".OOGGGGGGGGGGOO.",
  "..OOOOOOOOOOOO..",
]

const SLIME_B = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "....OOOOOOOO....",
  "...OGGGGGGGGO...",
  "..OGGGGGGGGGGO..",
  "..OGGGGGGGGGGO..",
  "..OGKWWGGWWKGO..",
  "..OGKKGGGGKKGO..",
  "..OGGGGGGGGGGO..",
  "..OGGGGGGGGGGO..",
  "...OGGGGGGGGO...",
  "...OOGGGGGGOO...",
  "....OOOOOOOO....",
]

const TILE_GRASS = [
  "LLLLLLLLLLLLLLLL",
  "LLGGGGGGGGGGGGLL",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
]

const TILE_DIRT = [
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
  "EEEEEEEEEEEEEEEE",
]

writeSheet("player.png", [KNIGHT_IDLE, KNIGHT_WALK1, KNIGHT_WALK2])
writeSheet("slime.png", [SLIME_A, SLIME_B])
writeSheet("tiles.png", [TILE_GRASS, TILE_DIRT])

const HELLO_OUT = path.resolve(new URL("..", import.meta.url).pathname, "examples/hello/assets")
fs.mkdirSync(HELLO_OUT, { recursive: true })
writeSheetTo(HELLO_OUT, "hero.png", [KNIGHT_IDLE])

function writeSheet(name, frames) {
  writeSheetTo(OUT, name, frames)
}

function writeSheetTo(outDirectory, name, frames) {
  const height = frames[0].length
  const frameWidth = frames[0][0].length
  const width = frameWidth * frames.length
  const colorSet = []
  const charToIndex = new Map()
  for (const frame of frames) {
    for (const row of frame) {
      for (const char of row) {
        if (!charToIndex.has(char)) {
          charToIndex.set(char, colorSet.length)
          colorSet.push(PALETTE[char] ?? PALETTE["."])
        }
      }
    }
  }
  const indices = new Uint8Array(width * height)
  for (let frame = 0; frame < frames.length; frame += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < frameWidth; x += 1) {
        indices[y * width + frame * frameWidth + x] = charToIndex.get(frames[frame][y][x])
      }
    }
  }
  fs.writeFileSync(path.join(outDirectory, name), encodeIndexedPng(width, height, indices, colorSet))
  console.log(`wrote ${name} (${width}x${height}, ${colorSet.length} colors)`)
}

function encodeIndexedPng(width, height, indices, colors) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 3
  const plte = Buffer.alloc(colors.length * 3)
  const trns = Buffer.alloc(colors.length)
  for (let i = 0; i < colors.length; i += 1) {
    plte[i * 3] = colors[i][0]
    plte[i * 3 + 1] = colors[i][1]
    plte[i * 3 + 2] = colors[i][2]
    trns[i] = colors[i][3]
  }
  const raw = Buffer.alloc((width + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (width + 1)] = 0
    for (let x = 0; x < width; x += 1) {
      raw[y * (width + 1) + 1 + x] = indices[y * width + x]
    }
  }
  const idat = zlib.deflateSync(raw)
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("PLTE", plte), chunk("tRNS", trns), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))])
}

function chunk(type, data) {
  const header = Buffer.alloc(8)
  header.writeUInt32BE(data.length, 0)
  header.write(type, 4, "ascii")
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 0)
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
