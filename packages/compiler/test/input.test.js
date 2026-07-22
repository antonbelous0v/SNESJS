import test from "node:test"
import assert from "node:assert/strict"

import { compile } from "../src/compile.js"
import { generateC } from "../src/codegen.js"

test("lowers Input.down to padHeld reads", () => {
  const result = compile(`const player = { x: 0 }
if (Input.down("LEFT")) player.x -= 1`)
  assert.equal(result.hasErrors, false)
  const c = generateC(result.ast)
  assert.match(c, /padHeld\(0\) & KEY_LEFT/)
})

test("lowers Input.pressed and Input.released", () => {
  const result = compile(`if (Input.pressed("A")) jump()
if (Input.released("B")) stop()`)
  const c = generateC(result.ast)
  assert.match(c, /padPressed\(0\) & KEY_A/)
  assert.match(c, /padReleased\(0\) & KEY_B/)
})

test("lowers Input.axis to directional combinations", () => {
  const result = compile(`player.x += Input.axis("horizontal")
player.y += Input.axis("vertical")`)
  const c = generateC(result.ast)
  assert.match(c, /KEY_RIGHT/)
  assert.match(c, /KEY_LEFT/)
  assert.match(c, /KEY_DOWN/)
  assert.match(c, /KEY_UP/)
})
