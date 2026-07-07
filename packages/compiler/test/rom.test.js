import test from "node:test"
import assert from "node:assert/strict"

import { RomPlanner, chooseRomMapping } from "../src/rom.js"

test("chooses LoROM for small games", () => {
  const sections = [{ name: "code", size: 0x4000 }, { name: "gfx", size: 0x10000 }]
  assert.equal(chooseRomMapping(sections), "lorom")
})

test("plans a single bank when sections fit", () => {
  const planner = new RomPlanner({ fastRom: true })
  const sections = [{ name: "code", size: 0x2000 }, { name: "data", size: 0x2000 }]
  const layout = planner.plan(sections)

  assert.equal(layout.mapping, "lorom")
  assert.equal(layout.banks.length, 1)
  assert.equal(layout.usedBytes, 0x4000)
  assert.equal(layout.totalBytes, 0x8000)
})

test("spills sections across multiple banks", () => {
  const planner = new RomPlanner()
  const sections = [{ name: "gfx", size: 0x6000 }, { name: "audio", size: 0x6000 }]
  const layout = planner.plan(sections)

  assert.equal(layout.banks.length, 2)
  assert.equal(layout.usedBytes, 0xc000)
})

test("respects an explicit mapping override", () => {
  const planner = new RomPlanner()
  const layout = planner.plan([{ name: "code", size: 0x1000 }], "hirom")
  assert.equal(layout.mapping, "hirom")
})
