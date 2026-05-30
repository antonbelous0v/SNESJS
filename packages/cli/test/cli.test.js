import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { loadProject } from "../src/project.js"
import { build, analyze } from "../src/commands.js"

function createDemoProject() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "snesjs-cli-"))
  fs.mkdirSync(path.join(directory, "src"), { recursive: true })
  fs.writeFileSync(path.join(directory, "snes.config.js"), `export default {
  name: "Demo",
  entry: "src/main.js",
  scenes: [{ name: "forest", assets: [{ type: "bg", name: "tiles", tiles: 970 }] }]
}
`)
  fs.writeFileSync(path.join(directory, "src", "main.js"), `let playerX = 120
function update() { playerX += 1 }
class Enemy {
  constructor(x) { this.x = x; this.hp = 3 }
  update() { this.x -= 1 }
}
`)
  return directory
}

test("loads project config and discovers source files", async () => {
  const directory = createDemoProject()
  const project = await loadProject(directory)
  assert.equal(project.name, "Demo")
  assert.equal(project.sourceFiles.length, 1)
  assert.match(project.sourceFiles[0], /main\.js$/)
  fs.rmSync(directory, { recursive: true })
})

test("build writes generated C and a report", async () => {
  const directory = createDemoProject()
  const result = await build(directory)
  assert.equal(result.success, true)

  const generated = fs.readFileSync(path.join(directory, "build", "generated", "main.gen.c"), "utf8")
  assert.match(generated, /typedef struct \{/)
  assert.match(generated, /void Enemy_update\(Enemy\* self\)/)
  assert.match(generated, /sj_wait_vblank\(\);/)

  const report = JSON.parse(fs.readFileSync(path.join(directory, "build", "report.json"), "utf8"))
  assert.equal(report.scenes[0].name, "forest")
  fs.rmSync(directory, { recursive: true })
})

test("build reports compiler errors with source locations", async () => {
  const directory = createDemoProject()
  fs.writeFileSync(path.join(directory, "src", "main.js"), `player.x = missing\n`)
  const result = await build(directory)
  assert.equal(result.success, false)
  assert.equal(result.generated.length, 0)
  fs.rmSync(directory, { recursive: true })
})

test("analyze renders hardware budgets", async () => {
  const directory = createDemoProject()
  const report = await analyze(directory)
  const text = report.renderText()
  assert.match(text, /SCENE FOREST/)
  assert.match(text, /VRAM/)
  fs.rmSync(directory, { recursive: true })
})
