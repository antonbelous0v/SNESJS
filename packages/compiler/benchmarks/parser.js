import { performance } from "node:perf_hooks"

import { parse } from "../src/parser.js"

const source = generateGameSource(120)

measure("parser", 50, () => parse(source))

function generateGameSource(statementCount) {
  const statements = [
    `import { Game, Scene, Sprite, Input, Animation, Camera, Audio } from "snes"`,
    `const player = new Sprite({ texture: assets.player, x: 120, y: 100 })`,
    `player.animation = new Animation({ frames: [0, 1, 2, 3], fps: 10 })`,
    `class Enemy { constructor(x, y) { this.x = x; this.y = y; this.hp = 3 } update() { this.x -= 1; if (this.x < 0) { this.alive = false } } }`,
  ]
  for (let index = 0; index < statementCount; index += 1) {
    statements.push(`if (Input.pressed("A") && player.onGround && state.health > ${index % 20}) { player.velocity.y = -${index % 8} - acceleration * 0.25 }`)
    statements.push(`enemy.velocity.x = Input.axis("horizontal") * 2 + Mathx.sin(angle) * ${index % 5}`)
    statements.push(`for (let i = 0; i < ${index % 16}; i++) { particles[i].x += particles[i].velocity.x }`)
  }
  return statements.join("\n")
}

function measure(name, iterations, action) {
  for (let index = 0; index < 3; index += 1) {
    action()
  }
  const start = performance.now()
  for (let index = 0; index < iterations; index += 1) {
    action()
  }
  const milliseconds = performance.now() - start
  const perIteration = milliseconds / iterations
  console.log(`${name.padEnd(10)} ${iterations.toString().padStart(4)} iterations ${milliseconds.toFixed(2).padStart(9)} ms ${perIteration.toFixed(3).padStart(9)} ms/iter`)
}
