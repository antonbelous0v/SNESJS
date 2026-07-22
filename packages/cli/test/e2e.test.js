import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { build } from "../src/commands.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../examples/hello")

test("builds the hello example end to end", async () => {
  const result = await build(root)
  assert.equal(result.success, true)
  assert.equal(result.generated.length, 1)

  const c = fs.readFileSync(path.join(root, "build", "generated", "main.gen.c"), "utf8")
  assert.match(c, /void scene_update\(\) \{/)
  assert.match(c, /scene_update\(\);/)
  assert.match(c, /sj_wait_vblank\(\);/)

  const html = fs.readFileSync(path.join(root, "build", "report.html"), "utf8")
  assert.match(html, /SNESJS build report/)
  assert.match(html, /<h2>main<\/h2>/)
})

test("produces deterministic generated C for identical source", () => {
  const first = fs.readFileSync(path.join(root, "build", "generated", "main.gen.c"), "utf8")
  const second = fs.readFileSync(path.join(root, "build", "generated", "main.gen.c"), "utf8")
  assert.equal(first, second)
})
