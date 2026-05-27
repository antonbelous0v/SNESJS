export const TypeKind = Object.freeze({
  Numeric: "Numeric",
  Bool: "Bool",
  Fixed: "Fixed",
  String: "String",
  Array: "Array",
  Object: "Object",
  Function: "Function",
  Asset: "Asset",
  Pointer: "Pointer",
  Unknown: "Unknown",
  Void: "Void",
  Null: "Null",
})

export const NumericKind = Object.freeze({
  U8: "u8",
  I8: "i8",
  U16: "u16",
  I16: "i16",
  U24: "u24",
  U32: "u32",
  I32: "i32",
})

const NUMERIC_BOUNDS = Object.freeze({
  u8: Object.freeze({ min: 0, max: 255, bits: 8, signed: false }),
  i8: Object.freeze({ min: -128, max: 127, bits: 8, signed: true }),
  u16: Object.freeze({ min: 0, max: 65535, bits: 16, signed: false }),
  i16: Object.freeze({ min: -32768, max: 32767, bits: 16, signed: true }),
  u24: Object.freeze({ min: 0, max: 16777215, bits: 24, signed: false }),
  u32: Object.freeze({ min: 0, max: 4294967295, bits: 32, signed: false }),
  i32: Object.freeze({ min: -2147483648, max: 2147483647, bits: 32, signed: true }),
})

const NUMERIC_ORDER = Object.freeze([NumericKind.U8, NumericKind.I8, NumericKind.U16, NumericKind.I16, NumericKind.U24, NumericKind.U32, NumericKind.I32])

export class Type {
  constructor(kind, options = {}) {
    this.kind = kind
    Object.assign(this, options)
  }

  static numeric(name) {
    return new Type(TypeKind.Numeric, { name, bounds: NUMERIC_BOUNDS[name] })
  }

  static fixed(name) {
    return new Type(TypeKind.Fixed, { name, bits: name === "fixed8" ? 8 : 16 })
  }

  static bool() {
    return new Type(TypeKind.Bool, { name: "bool" })
  }

  static string() {
    return new Type(TypeKind.String, { name: "string" })
  }

  static array(elementType) {
    return new Type(TypeKind.Array, { name: `array<${elementType.name}>`, elementType })
  }

  static object(fields) {
    return new Type(TypeKind.Object, { name: "object", fields })
  }

  static unknown() {
    return new Type(TypeKind.Unknown, { name: "unknown" })
  }

  static voidType() {
    return new Type(TypeKind.Void, { name: "void" })
  }

  isNumeric() {
    return this.kind === TypeKind.Numeric
  }

  isFixed() {
    return this.kind === TypeKind.Fixed
  }

  isNumberLike() {
    return this.kind === TypeKind.Numeric || this.kind === TypeKind.Fixed
  }

  cName() {
    if (this.kind === TypeKind.Bool) {
      return "bool"
    }
    if (this.kind === TypeKind.Fixed) {
      return this.bits === 8 ? "signed char" : "short"
    }
    if (this.kind === TypeKind.String) {
      return "const char*"
    }
    if (this.kind === TypeKind.Void) {
      return "void"
    }
    if (this.kind === TypeKind.Numeric) {
      const mapping = { u8: "unsigned char", i8: "signed char", u16: "unsigned short", i16: "short", u24: "unsigned long", u32: "unsigned long", i32: "long" }
      return mapping[this.name]
    }
    return "int"
  }

  equals(other) {
    if (!other) {
      return false
    }
    if (this.kind !== other.kind) {
      return false
    }
    if (this.kind === TypeKind.Numeric || this.kind === TypeKind.Fixed) {
      return this.name === other.name
    }
    return true
  }
}

export const BUILTIN_TYPES = Object.freeze({
  u8: Type.numeric(NumericKind.U8),
  i8: Type.numeric(NumericKind.I8),
  u16: Type.numeric(NumericKind.U16),
  i16: Type.numeric(NumericKind.I16),
  u24: Type.numeric(NumericKind.U24),
  u32: Type.numeric(NumericKind.U32),
  i32: Type.numeric(NumericKind.I32),
  bool: Type.bool(),
  fixed8: Type.fixed("fixed8"),
  fixed16: Type.fixed("fixed16"),
  string: Type.string(),
})

export function narrowestIntegerType(min, max) {
  for (const name of NUMERIC_ORDER) {
    const bounds = NUMERIC_BOUNDS[name]
    if (min >= bounds.min && max <= bounds.max) {
      return Type.numeric(name)
    }
  }
  return Type.numeric(NumericKind.I32)
}

export function valueRange(value) {
  if (!Number.isFinite(value)) {
    return { min: -2147483648, max: 2147483647 }
  }
  const floor = Math.floor(value)
  return { min: floor, max: floor }
}

export function promotedNumericType(left, right) {
  if (left.kind === TypeKind.Fixed || right.kind === TypeKind.Fixed) {
    return Type.fixed("fixed16")
  }
  if (!left.isNumeric() || !right.isNumeric()) {
    return left.isNumeric() ? left : right
  }
  const bits = Math.max(left.bounds.bits, right.bounds.bits)
  const signed = left.bounds.signed && right.bounds.signed
  for (const name of NUMERIC_ORDER) {
    const bounds = NUMERIC_BOUNDS[name]
    if (bounds.bits === bits && bounds.signed === signed) {
      return Type.numeric(name)
    }
  }
  return Type.numeric(NumericKind.I32)
}

export function rangeForType(type) {
  if (type.kind === TypeKind.Numeric) {
    return type.bounds
  }
  if (type.kind === TypeKind.Fixed) {
    return { min: type.bits === 8 ? -128 : -32768, max: type.bits === 8 ? 127 : 32767 }
  }
  return { min: 0, max: 0 }
}

export function canOverflow(type, value) {
  const bounds = rangeForType(type)
  return value < bounds.min || value > bounds.max
}
