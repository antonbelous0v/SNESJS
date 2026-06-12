const TYPE_WIDTHS = Object.freeze({
  u8: 1,
  i8: 1,
  bool: 1,
  u16: 2,
  i16: 2,
  u32: 4,
  i32: 4,
})

export class SaveSchema {
  constructor(version, fields) {
    this.version = version
    this.fields = fields
    this.width = this.computeWidth(fields)
  }

  computeWidth(fields) {
    let width = 1
    for (const [name, spec] of Object.entries(fields)) {
      if (Array.isArray(spec)) {
        width += TYPE_WIDTHS[spec[0]] * spec[1]
      } else {
        width += TYPE_WIDTHS[spec] ?? 1
      }
    }
    return width
  }
}

export class SaveData {
  constructor(schema) {
    this.schema = schema
    this.data = {}
    for (const [name, spec] of Object.entries(schema.fields)) {
      if (Array.isArray(spec)) {
        this.data[name] = new Array(spec[1]).fill(0)
      } else {
        this.data[name] = 0
      }
    }
  }
}

export function checksum16(bytes) {
  let sum1 = 0
  let sum2 = 0
  for (const byte of bytes) {
    sum1 = (sum1 + byte) % 255
    sum2 = (sum2 + sum1) % 255
  }
  return (sum2 << 8) | sum1
}

export function serializeSave(schema, data) {
  const bytes = [schema.version]
  for (const [name, spec] of Object.entries(schema.fields)) {
    const value = data[name]
    if (Array.isArray(spec)) {
      const [type, count] = spec
      for (let index = 0; index < count; index += 1) {
        writeNumber(bytes, value[index], TYPE_WIDTHS[type])
      }
    } else {
      writeNumber(bytes, value, TYPE_WIDTHS[spec])
    }
  }
  const sum = checksum16(bytes)
  bytes.push(sum & 0xff, (sum >> 8) & 0xff)
  return Uint8Array.from(bytes)
}

export function deserializeSave(schema, bytes) {
  if (bytes[0] !== schema.version) {
    return { ok: false, reason: `version mismatch: expected ${schema.version}, got ${bytes[0]}` }
  }
  const expectedSum = bytes[bytes.length - 2] | (bytes[bytes.length - 1] << 8)
  const body = bytes.subarray(0, bytes.length - 2)
  if (checksum16(body) !== expectedSum) {
    return { ok: false, reason: "checksum mismatch" }
  }

  const data = {}
  let offset = 1
  for (const [name, spec] of Object.entries(schema.fields)) {
    if (Array.isArray(spec)) {
      const [type, count] = spec
      const values = new Array(count)
      for (let index = 0; index < count; index += 1) {
        values[index] = readNumber(bytes, offset, TYPE_WIDTHS[type])
        offset += TYPE_WIDTHS[type]
      }
      data[name] = values
    } else {
      data[name] = readNumber(bytes, offset, TYPE_WIDTHS[spec])
      offset += TYPE_WIDTHS[spec]
    }
  }
  return { ok: true, data }
}

export function migrateSave(schema, data, migrations) {
  let current = data
  let version = schema.version
  for (const [from, to, migrate] of migrations) {
    if (from >= version) {
      current = migrate(current)
      version = to
    }
  }
  return current
}

function writeNumber(bytes, value, width) {
  for (let index = 0; index < width; index += 1) {
    bytes.push((value >> (index * 8)) & 0xff)
  }
}

function readNumber(bytes, offset, width) {
  let value = 0
  for (let index = 0; index < width; index += 1) {
    value |= bytes[offset + index] << (index * 8)
  }
  return value
}
