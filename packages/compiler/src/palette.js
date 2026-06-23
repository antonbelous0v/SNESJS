export function rgb555(red, green, blue) {
  const r = Math.round(red / 255 * 31) & 0x1f
  const g = Math.round(green / 255 * 31) & 0x1f
  const b = Math.round(blue / 255 * 31) & 0x1f
  return (b << 10) | (g << 5) | r
}

export function unpack555(value) {
  const r = (value & 0x1f) * 255 / 31
  const g = ((value >> 5) & 0x1f) * 255 / 31
  const b = ((value >> 10) & 0x1f) * 255 / 31
  return [Math.round(r), Math.round(g), Math.round(b)]
}

export function collectUniqueColors(pixels, channels = 4) {
  const unique = new Map()
  for (let index = 0; index < pixels.length; index += channels) {
    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]
    const key = (red << 16) | (green << 8) | blue
    if (!unique.has(key)) {
      unique.set(key, { red, green, blue, count: 0 })
    }
    unique.get(key).count += 1
  }
  return [...unique.values()]
}

export function quantizePalette(colors, maxColors = 16) {
  const quantized = []
  const seen = new Map()
  for (const color of colors) {
    const value = rgb555(color.red, color.green, color.blue)
    if (!seen.has(value)) {
      seen.set(value, quantized.length)
      quantized.push(value)
    }
    if (quantized.length >= maxColors) {
      break
    }
  }
  return quantized
}

export function paletteBytes(colorCount) {
  return colorCount * 2
}

export function groupSharedPalette(entries, maxColors = 16) {
  const merged = new Map()
  for (const entry of entries) {
    for (const color of entry.colors) {
      const value = rgb555(color.red, color.green, color.blue)
      if (!merged.has(value)) {
        merged.set(value, color)
      }
      if (merged.size >= maxColors) {
        break
      }
    }
    if (merged.size >= maxColors) {
      break
    }
  }
  return [...merged.values()]
}

export function colorError(original, quantized) {
  const [r1, g1, b1] = original
  const [r2, g2, b2] = unpack555(quantized)
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

export function paletteDeltaE(colors) {
  if (colors.length === 0) {
    return { average: 0, max: 0 }
  }
  const errors = colors.map((color) => {
    const quantized = rgb555(color.red, color.green, color.blue)
    return colorError([color.red, color.green, color.blue], quantized)
  })
  const total = errors.reduce((sum, value) => sum + value, 0)
  return { average: total / errors.length, max: Math.max(...errors) }
}
