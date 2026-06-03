import zlib from "node:zlib"

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export class PngDecodeError extends Error {
  constructor(message) {
    super(message)
    this.name = "PngDecodeError"
  }
}

export function decodePng(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    buffer = Buffer.from(buffer)
  }
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new PngDecodeError("Not a PNG file: signature mismatch")
  }

  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let palette = null
  const idatChunks = []

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString("ascii", offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)

    if (type === "IHDR") {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      const compression = data[10]
      const interlace = data[12]
      if (compression !== 0) {
        throw new PngDecodeError(`Unsupported compression method ${compression}`)
      }
      if (interlace !== 0) {
        throw new PngDecodeError("Interlaced PNG is not supported")
      }
    } else if (type === "PLTE") {
      palette = []
      for (let index = 0; index < length; index += 3) {
        palette.push({ red: data[index], green: data[index + 1], blue: data[index + 2] })
      }
    } else if (type === "IDAT") {
      idatChunks.push(data)
    } else if (type === "IEND") {
      break
    }
    offset += 12 + length
  }

  if (width === 0 || height === 0) {
    throw new PngDecodeError("Missing IHDR chunk")
  }

  const inflated = zlib.inflateSync(Buffer.concat(idatChunks))
  const channels = colorChannels(colorType)
  const bytesPerPixel = Math.max(1, channels * bitDepth / 8)
  const stride = width * bytesPerPixel
  const raw = new Uint8Array((stride + 1) * height)
  let source = 0
  let target = 0
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[source]
    source += 1
    for (let index = 0; index < stride; index += 1) {
      raw[target + index] = inflated[source + index]
    }
    applyFilter(raw, target, stride, bytesPerPixel, filter)
    source += stride
    target += stride
  }

  const pixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = y * stride + x * bytesPerPixel
      const targetOffset = (y * width + x) * 4
      const [red, green, blue, alpha] = sampleColor(raw, sourceOffset, colorType, bitDepth, channels, palette)
      pixels[targetOffset] = red
      pixels[targetOffset + 1] = green
      pixels[targetOffset + 2] = blue
      pixels[targetOffset + 3] = alpha
    }
  }
  return { width, height, pixels, bitDepth, colorType }
}

function colorChannels(colorType) {
  switch (colorType) {
    case 0:
      return 1
    case 2:
      return 3
    case 3:
      return 1
    case 4:
      return 2
    case 6:
      return 4
    default:
      throw new PngDecodeError(`Unsupported color type ${colorType}`)
  }
}

function sampleColor(raw, offset, colorType, bitDepth, channels, palette) {
  if (colorType === 0) {
    const value = raw[offset]
    return [value, value, value, 255]
  }
  if (colorType === 2) {
    return [raw[offset], raw[offset + 1], raw[offset + 2], 255]
  }
  if (colorType === 3) {
    const entry = palette[raw[offset]]
    return entry ? [entry.red, entry.green, entry.blue, 255] : [0, 0, 0, 255]
  }
  if (colorType === 4) {
    return [raw[offset], raw[offset], raw[offset], raw[offset + 1]]
  }
  if (colorType === 6) {
    return [raw[offset], raw[offset + 1], raw[offset + 2], raw[offset + 3]]
  }
  return [0, 0, 0, 255]
}

function applyFilter(raw, start, stride, bytesPerPixel, filter) {
  const row = raw.subarray(start, start + stride)
  switch (filter) {
    case 0:
      return
    case 1:
      for (let index = bytesPerPixel; index < stride; index += 1) {
        row[index] = (row[index] + row[index - bytesPerPixel]) & 0xff
      }
      return
    case 2:
      if (start >= stride) {
        const previous = raw.subarray(start - stride, start)
        for (let index = 0; index < stride; index += 1) {
          row[index] = (row[index] + previous[index]) & 0xff
        }
      }
      return
    case 3: {
      if (start >= stride) {
        const previous = raw.subarray(start - stride, start)
        for (let index = 0; index < stride; index += 1) {
          const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0
          row[index] = (row[index] + Math.floor((left + previous[index]) / 2)) & 0xff
        }
      } else {
        for (let index = bytesPerPixel; index < stride; index += 1) {
          row[index] = (row[index] + Math.floor(row[index - bytesPerPixel] / 2)) & 0xff
        }
      }
      return
    }
    case 4: {
      if (start >= stride) {
        const previous = raw.subarray(start - stride, start)
        for (let index = 0; index < stride; index += 1) {
          const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0
          const up = previous[index]
          const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0
          row[index] = (row[index] + paethPredictor(left, up, upLeft)) & 0xff
        }
      } else {
        for (let index = bytesPerPixel; index < stride; index += 1) {
          const left = row[index - bytesPerPixel]
          row[index] = (row[index] + paethPredictor(left, 0, 0)) & 0xff
        }
      }
      return
    }
    default:
      return
  }
}

function paethPredictor(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) {
    return a
  }
  if (pb <= pc) {
    return b
  }
  return c
}
