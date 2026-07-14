import test from "node:test"
import assert from "node:assert/strict"

import { ResourceAnalyzer, SceneResources, AssetResources, HARDWARE_BUDGETS, formatBytes } from "../src/resources.js"
import { BuildReport } from "../src/report.js"
import { Tile, TileDeduplicator, deduplicateTiles, reverseBits, tileBytes, savedBytes } from "../src/tiles.js"
import { DiagnosticBag } from "../src/contracts/diagnostics.js"

test("tracks VRAM, CGRAM and OAM usage per scene", () => {
  const scene = new SceneResources("forest")
  scene.add(new AssetResources({ type: "bg", name: "forest_tiles", vramBytes: 31000, cgramColors: 80 }))
  scene.add(new AssetResources({ type: "sprite", name: "player", vramBytes: 4000, cgramColors: 16, oamSprites: 8 }))

  const analyzer = new ResourceAnalyzer()
  const result = analyzer.analyze(scene)

  assert.equal(result.usage.vram, 35000)
  assert.equal(result.usage.cgram, 96)
  assert.equal(result.usage.oam, 8)
  assert.equal(result.budgets.vram.overBudget, false)
})

test("reports E4201 when VRAM budget is exceeded", () => {
  const diagnostics = new DiagnosticBag()
  const scene = new SceneResources("castle")
  scene.add(new AssetResources({ type: "bg", name: "castle_tiles", vramBytes: 70000 }))

  const analyzer = new ResourceAnalyzer(diagnostics)
  analyzer.analyze(scene)

  assert.equal(diagnostics.errors.length, 1)
  assert.equal(diagnostics.errors[0].code, "E4201")
  assert.match(diagnostics.errors[0].message, /VRAM/)
})

test("computes budget utilization and availability", () => {
  const scene = new SceneResources("boss_room")
  scene.add(new AssetResources({ type: "sprite", name: "boss", oamSprites: 93 }))
  const result = new ResourceAnalyzer().analyze(scene)

  assert.equal(result.budgets.oam.limit, HARDWARE_BUDGETS.oamSprites)
  assert.equal(result.budgets.oam.available, 35)
  assert.ok(Math.abs(result.budgets.oam.utilization - 93 / 128) < 1e-9)
})

test("reverseBits flips 8-bit rows for horizontal mirroring", () => {
  assert.equal(reverseBits(0b00000001, 8), 0b10000000)
  assert.equal(reverseBits(0b10101010, 8), 0b01010101)
})

test("deduplicates tiles with flip equivalence", () => {
  const base = new Tile([0b11110000, 0b00000000, 0, 0, 0, 0, 0, 0])
  const horizontal = base.flippedHorizontal()
  const tiles = [base, horizontal, base]

  const result = deduplicateTiles(tiles)
  assert.equal(result.originalCount, 3)
  assert.equal(result.uniqueCount, 1)
  assert.equal(result.results[1].flip, "h")
  assert.equal(result.results[2].flip, "plain")
})

test("reports VRAM savings from deduplication", () => {
  const tiles = Array.from({ length: 400 }, () => new Tile([0, 0, 0, 0, 0, 0, 0, 0]))
  const result = deduplicateTiles(tiles)
  assert.equal(result.uniqueCount, 1)
  assert.equal(tileBytes(result.uniqueCount), 32)
  assert.equal(savedBytes(400, 1), 399 * 32)
})

test("formats byte counts for reports", () => {
  assert.equal(formatBytes(512), "512 B")
  assert.equal(formatBytes(65536), "64.0 KiB")
})

test("renders a text build report with budgets", () => {
  const scene = new SceneResources("forest")
  scene.add(new AssetResources({ type: "bg", name: "tiles", vramBytes: 1024, cgramColors: 32 }))
  const analysis = new ResourceAnalyzer().analyze(scene)

  const report = new BuildReport({ scenes: [analysis], warnings: ["DMA budget risk"], metrics: { romBytes: 1699225 } })
  const text = report.renderText()

  assert.match(text, /SNESJS build report/)
  assert.match(text, /SCENE FOREST/)
  assert.match(text, /VRAM/)
  assert.match(text, /DMA budget risk/)
  assert.match(text, /ROM size 1.6 MiB/)

  const json = report.toJSON()
  assert.equal(json.scenes[0].name, "forest")
  assert.equal(json.hardware.vramBytes, 65536)
})

test("renders an HTML build report with budget tables", () => {
  const scene = new SceneResources("forest")
  scene.add(new AssetResources({ type: "bg", name: "tiles", vramBytes: 64000 }))
  const analysis = new ResourceAnalyzer().analyze(scene)

  const report = new BuildReport({ scenes: [analysis], warnings: ["DMA budget risk"], metrics: { romBytes: 1024 * 1024 } })
  const html = report.renderHtml()

  assert.match(html, /<!doctype html>/)
  assert.match(html, /SNESJS build report/)
  assert.match(html, /<table>/)
  assert.match(html, /VRAM/)
  assert.match(html, /DMA budget risk/)
  assert.match(html, /1.0 MiB/)
})
