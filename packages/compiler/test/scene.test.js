import test from "node:test"
import assert from "node:assert/strict"

import { compile } from "../src/compile.js"
import { generateC } from "../src/codegen.js"
import { parse } from "../src/parser.js"
import { NodeKind } from "../src/ast.js"

test("parses object method shorthand in scene definitions", () => {
  const ast = parse(`Scene.define("main", {
  update() { player.x += 1 }
})`)
  const call = ast.statements[0].expression
  assert.equal(call.callee.object.name, "Scene")
  const config = call.arguments[1]
  assert.equal(config.properties[0].method, true)
  assert.equal(config.properties[0].value.kind, NodeKind.FunctionExpression)
})

test("lowers scene update methods to C functions", () => {
  const result = compile(`const player = { x: 0 }
Scene.define("main", {
  update() {
    if (Input.down("LEFT")) player.x -= 1
  }
})
Game.start("main")`)
  assert.equal(result.hasErrors, false)
  const c = generateC(result.ast)

  assert.match(c, /void scene_update\(\) \{/)
  assert.match(c, /player\.x -= 1;/)
  assert.match(c, /scene_update\(\);/)
})

test("emits the scene update in the runtime main loop", () => {
  const result = compile(`Scene.define("forest", {
  update() { camera.x += 1 }
})`)
  const c = generateC(result.ast)
  assert.match(c, /while \(1\) \{/)
  assert.match(c, /scene_update\(\);/)
})
