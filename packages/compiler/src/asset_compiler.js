import { decodePng } from "./png.js"
import { collectUniqueColors, quantizePalette, paletteDeltaE } from "./palette.js"
import { BitmapImage, extractTiles, indicesToBitplanes } from "./bitmap.js"
import { Tile, TileDeduplicator } from "./tiles.js"

export class CompiledSpriteAsset {
  constructor({ name, width, height, tiles, palette, vramBytes, deltaE, uniqueCount }) {
    this.name = name
    this.width = width
    this.height = height
    this.tiles = tiles
    this.palette = palette
    this.vramBytes = vramBytes
    this.deltaE = deltaE
    this.uniqueCount = uniqueCount
  }
}

export class AssetCompiler {
  constructor({ maxColors = 16 } = {}) {
    this.maxColors = maxColors
  }

  compileSprite(name, pngBuffer) {
    const image = decodePng(pngBuffer)
    const bitmap = new BitmapImage({ width: image.width, height: image.height, pixels: image.pixels })
    const extracted = extractTiles(bitmap)

    const colors = collectUniqueColors(image.pixels)
    const palette = quantizePalette(colors, this.maxColors)
    const deltaE = paletteDeltaE(colors)
    const paletteMap = new Map(palette.map((value, index) => [value, index]))

    const deduplicator = new TileDeduplicator()
    const tiles = extracted.map((tile) => {
      const indices = tile.pixels.map(pixel => pixel.alpha === 0 ? 0 : paletteMap.get(pixelIndexValue(pixel)) ?? 0)
      const result = deduplicator.index(new Tile(indicesToRows(indices)))
      return { x: tile.x, y: tile.y, index: result.index, flip: result.flip, bitplanes: indicesToBitplanes(indices) }
    })

    return new CompiledSpriteAsset({
      name,
      width: image.width,
      height: image.height,
      tiles,
      palette,
      vramBytes: deduplicator.unique.size * 32,
      deltaE,
      uniqueCount: deduplicator.unique.size,
    })
  }
}

export function compileSpriteAsset(name, pngBuffer, options) {
  return new AssetCompiler(options).compileSprite(name, pngBuffer)
}

function pixelIndexValue(pixel) {
  return ((pixel.red >> 3) << 10) | ((pixel.green >> 3) << 5) | (pixel.blue >> 3)
}

function indicesToRows(indices) {
  const rows = []
  for (let y = 0; y < 8; y += 1) {
    let row = 0
    for (let x = 0; x < 8; x += 1) {
      row = (row << 1) | (indices[y * 8 + x] & 1)
    }
    rows.push(row)
  }
  return rows
}
