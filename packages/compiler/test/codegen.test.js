import test from "node:test"
import assert from "node:assert/strict"

import { compile } from "../src/compile.js"
import { generateC } from "../src/codegen.js"
import { NodeKind } from "../src/ast.js"

test("lowers classes to C structs and methods", () => {
  const result = compile(`class Enemy {
  constructor(x, y) { this.x = x; this.hp = 3 }
  update() { this.x -= 1 }
}`)
  assert.equal(result.hasErrors, false)
  const c = generateC(result.ast)

  assert.match(c, /typedef struct \{/)
  assert.match(c, /short x;/)
  assert.match(c, /unsigned char hp;/)
  assert.match(c, /\} Enemy;/)
  assert.match(c, /void Enemy_update\(Enemy\* self\) \{/)
  assert.match(c, /self->x -= 1;/)
})

test("lowers arithmetic and control flow to C", () => {
  const result = compile(`let lives = 3
lives -= 1
if (lives > 0) { lives += 2 }`)
  assert.equal(result.hasErrors, false)
  const c = generateC(result.ast)

  assert.match(c, /unsigned char lives = 3;/)
  assert.match(c, /lives -= 1;/)
  assert.match(c, /if \(lives > 0\) \{/)
})

test("lowers loops to bounded C for statements", () => {
  const result = compile(`let total = 0
for (let i = 0; i < 10; i++) { total += i }`)
  assert.equal(result.hasErrors, false)
  const c = generateC(result.ast)

  assert.match(c, /for \(unsigned char i = 0; i < 10; \(i\+\+\)\) \{/)
})

test("maps SNES numeric types to C primitive types", () => {
  const result = compile(`let a = 300
let b = -5`)
  const c = generateC(result.ast)
  assert.match(c, /unsigned short a = 300;/)
  assert.match(c, /signed char b = \(-5\);/)
  assert.match(c, /unsigned short a = 300;/)
  assert.match(c, /signed char b = \(-5\);/)
})

test("emits the runtime main loop with VBlank synchronization", () => {
  const result = compile(`function update() { player.x += 1 }`)
  const c = generateC(result.ast)
  assert.match(c, /int main\(void\) \{/)
  assert.match(c, /sj_init\(\);/)
  assert.match(c, /sj_wait_vblank\(\);/)
  assert.match(c, /update\(\);/)
  assert.match(c, /sj_flush_dma\(\);/)
})

test("collects fields assigned in constructors", () => {
  const result = compile(`class Bullet {
  constructor(x, y) { this.x = x; this.y = y; this.speed = 4 }
}`)
  const c = generateC(result.ast)
  assert.match(c, /x;/)
  assert.match(c, /y;/)
  assert.match(c, /speed;/)
})
