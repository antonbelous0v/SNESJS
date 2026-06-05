import test from "node:test"
import assert from "node:assert/strict"

import { parse } from "../src/parser.js"
import { buildSourceMap, SourceMapGenerator } from "../src/sourcemap.js"

test("maps declarations back to their source lines", () => {
  const ast = parse(`function update() {
  player.x += 1
}

class Enemy {
  update() { this.x -= 1 }
}
`)
  const generator = new SourceMapGenerator()
  generator.markGeneratedLine()
  generator.mapNode(ast.statements[0], "update")
  generator.markGeneratedLine()
  generator.mapNode(ast.statements[1], "Enemy")

  const json = generator.toJSON("main.js")
  assert.equal(json.sources[0], "main.js")
  assert.equal(json.mappings.length, 2)
  assert.equal(json.mappings[0].sourceLine, 1)
  assert.equal(json.mappings[1].sourceLine, 5)
})

test("builds a source map from a parsed program", () => {
  const ast = parse(`let lives = 3
function tick() { lives -= 1 }`)
  const map = buildSourceMap(ast, "game.js")
  const json = map.toJSON("game.js")

  assert.ok(json.mappings.length >= 2)
  assert.ok(json.mappings.some(mapping => mapping.symbol === "tick"))
})

test("resolves a generated symbol back to a source location", () => {
  const ast = parse(`class Slime {
  update() { this.x -= 1 }
}`)
  const map = buildSourceMap(ast)
  const location = map.resolve(ast, "update")
  assert.ok(location)
  assert.ok(location.line >= 1)
})
