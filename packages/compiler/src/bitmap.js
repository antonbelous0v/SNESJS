export class BitmapImage {
  constructor({ width, height, pixels }) {
    this.width = width
    this.height = height
    this.pixels = pixels
  }

  get tilesWide() {
    return Math.ceil(this.width / 8)
  }

  get tilesHigh() {
    return Math.ceil(this.height / 8)
  }

  pixel(x, y) {
    const index = (y * this.width + x) * 4
    return {
      red: this.pixels[index],
      green: this.pixels[index + 1],
      blue: this.pixels[index + 2],
      alpha: this.pixels[index + 3] ?? 255,
    }
  }
}

export function extractTiles(image) {
  const tiles = []
  for (let tileY = 0; tileY < image.tilesHigh; tileY += 1) {
    for (let tileX = 0; tileX < image.tilesWide; tileX += 1) {
      const pixels = []
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          const px = tileX * 8 + x
          const py = tileY * 8 + y
          if (px < image.width && py < image.height) {
            pixels.push(image.pixel(px, py))
          } else {
            pixels.push({ red: 0, green: 0, blue: 0, alpha: 0 })
          }
        }
      }
      tiles.push({ x: tileX, y: tileY, pixels })
    }
  }
  return tiles
}

export function pixelsToIndices(pixels, palette) {
  const map = new Map()
  palette.forEach((value, index) => map.set(value, index))
  const indices = new Array(pixels.length)
  for (let index = 0; index < pixels.length; index += 1) {
    const pixel = pixels[index]
    const value = pixel.alpha === 0 ? 0 : (pixel.paletteIndex ?? map.get(pixel.value) ?? 0)
    indices[index] = value
  }
  return indices
}

export function indicesToBitplanes(indices) {
  const rows = []
  for (let y = 0; y < 8; y += 1) {
    let plane0 = 0
    let plane1 = 0
    let plane2 = 0
    let plane3 = 0
    for (let x = 0; x < 8; x += 1) {
      const value = indices[y * 8 + x]
      const bit = 7 - x
      plane0 |= ((value >> 0) & 1) << bit
      plane1 |= ((value >> 1) & 1) << bit
      plane2 |= ((value >> 2) & 1) << bit
      plane3 |= ((value >> 3) & 1) << bit
    }
    rows.push(plane0, plane1, plane2, plane3)
  }
  return rows
}

export function tileToBitplanes(tile) {
  const indices = tile.pixels.map(pixel => pixel.index ?? pixel.paletteIndex ?? 0)
  return indicesToBitplanes(indices)
}

export function bitplaneByteCount(tileCount) {
  return tileCount * 32
}
