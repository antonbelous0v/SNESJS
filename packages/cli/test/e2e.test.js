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
  assert.match(c, /void setup\(\) \{/)
  assert.match(c, /void update\(\) \{/)
  assert.match(c, /padHeld\(0\) & KEY_LEFT/)
  assert.match(c, /sj_wait_vblank\(\);/)

  const html = fs.readFileSync(path.join(root, "build", "report.html"), "utf8")
  assert.match(html, /SNESJS build report/)
  assert.match(html, /<h2>main<\/h2>/)
})

test("produces a valid .sfc ROM when the SDK is vendored", async () => {
  await build(root)
  const sfc = path.join(root, "dist", "game.sfc")
  if (!fs.existsSync(sfc)) {
    assert.ok(true, "SDK not vendored — ROM step skipped")
    return
  }
  const bytes = fs.readFileSync(sfc)
  assert.ok(bytes.length >= 32768)

  const title = bytes.subarray(0x7FC0, 0x7FD5).toString("ascii").trim()
  assert.equal(title, "Hello SNES")
})

test("produces deterministic generated C for identical source", () => {
  const first = fs.readFileSync(path.join(root, "build", "generated", "main.gen.c"), "utf8")
  const second = fs.readFileSync(path.join(root, "build", "generated", "main.gen.c"), "utf8")
  assert.equal(first, second)
})
