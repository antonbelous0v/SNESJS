import test from "node:test"
import assert from "node:assert/strict"

import { parse } from "../src/parser.js"
import { TypeInferrer } from "../src/analyzer.js"
import { Type, TypeKind, BUILTIN_TYPES, narrowestIntegerType, promotedNumericType, canOverflow } from "../src/types.js"
import { NodeKind } from "../src/ast.js"
import { DiagnosticBag } from "../src/contracts/diagnostics.js"

test("infers minimal safe integer types for literals", () => {
  assert.equal(narrowestIntegerType(0, 3).name, "u8")
  assert.equal(narrowestIntegerType(-5, 5).name, "i8")
  assert.equal(narrowestIntegerType(0, 300).name, "u16")
  assert.equal(narrowestIntegerType(0, 70000).name, "u24")
  assert.equal(narrowestIntegerType(-40000, 0).name, "i32")
})

test("promotes numeric types in binary expressions", () => {
  const result = promotedNumericType(BUILTIN_TYPES.u8, BUILTIN_TYPES.u16)
  assert.equal(result.name, "u16")
  const unsigned = promotedNumericType(BUILTIN_TYPES.i8, BUILTIN_TYPES.u16)
  assert.equal(unsigned.name, "u16")
  const signed = promotedNumericType(BUILTIN_TYPES.i8, BUILTIN_TYPES.i16)
  assert.equal(signed.name, "i16")
})

test("detects integer overflow against type bounds", () => {
  assert.equal(canOverflow(Type.numeric("u8"), 256), true)
  assert.equal(canOverflow(Type.numeric("u8"), 255), false)
  assert.equal(canOverflow(Type.numeric("i8"), -129), true)
})

test("attaches inferred types to variables and expressions", () => {
  const diagnostics = new DiagnosticBag()
  const ast = parse(`let lives = 3
let x = 120
x -= 5
const ratio = 0.25`)
  const inferrer = new TypeInferrer(diagnostics)
  inferrer.infer(ast)

  const lives = ast.statements[0].declarations[0]
  assert.equal(lives.init.type.name, "u8")

  const ratio = ast.statements[3].declarations[0]
  assert.equal(ratio.init.type.kind, TypeKind.Fixed)

  assert.equal(diagnostics.errors.length, 0)
})

test("resolves identifiers through nested scopes", () => {
  const diagnostics = new DiagnosticBag()
  const ast = parse(`let health = 100
function tick() {
  let local = 1
  health -= 1
  return local
}`)
  const inferrer = new TypeInferrer(diagnostics)
  inferrer.infer(ast)
  assert.equal(diagnostics.errors.length, 0)

  const returnStatement = ast.statements[1].body.body[2]
  assert.equal(returnStatement.argument.symbol.name, "local")
})

test("reports unknown identifiers with source spans", () => {
  const diagnostics = new DiagnosticBag()
  const ast = parse(`const player = 1
player.velocity.x = missing + 1`)
  new TypeInferrer(diagnostics).infer(ast)
  const error = diagnostics.errors.find(item => item.code === "E1201")
  assert.ok(error)
  assert.ok(error.span.start.line >= 1)
})

test("reports string assigned to numeric field", () => {
  const diagnostics = new DiagnosticBag()
  const ast = parse(`let velocityX = 0
velocityX = "fast"`)
  new TypeInferrer(diagnostics).infer(ast)
  assert.ok(diagnostics.errors.some(error => error.code === "E2013"))
})

test("warns on statically known u8 overflow", () => {
  const diagnostics = new DiagnosticBag()
  const ast = parse(`let value = 255
value += 10`)
  new TypeInferrer(diagnostics).infer(ast)
  assert.ok(diagnostics.warnings.some(warning => warning.code === "W2101"))
})

test("resolves this inside class methods", () => {
  const diagnostics = new DiagnosticBag()
  const ast = parse(`class Enemy {
  constructor(x) { this.hp = 3 }
  update() { this.hp -= 1 }
}`)
  new TypeInferrer(diagnostics).infer(ast)
  assert.equal(diagnostics.errors.length, 0)

  const update = ast.statements[0].methods[1].value.body.body[0]
  assert.equal(update.expression.left.object.kind, NodeKind.ThisExpression)
})
