import test from "node:test"
import assert from "node:assert/strict"

import { SaveSchema, SaveData, serializeSave, deserializeSave, checksum16, migrateSave } from "../src/save.js"

const SCHEMA = new SaveSchema(1, {
  level: "u8",
  health: "u8",
  coins: "u16",
  flags: ["u8", 32],
})

test("round-trips a save through binary serialization", () => {
  const data = { level: 4, health: 100, coins: 32000, flags: new Array(32).fill(0) }
  data.flags[3] = 1
  const bytes = serializeSave(SCHEMA, data)
  const result = deserializeSave(SCHEMA, bytes)

  assert.equal(result.ok, true)
  assert.equal(result.data.level, 4)
  assert.equal(result.data.health, 100)
  assert.equal(result.data.coins, 32000)
  assert.equal(result.data.flags[3], 1)
})

test("detects version mismatch", () => {
  const bytes = serializeSave(SCHEMA, { level: 1, health: 1, coins: 1, flags: new Array(32).fill(0) })
  const wrong = new SaveSchema(2, SCHEMA.fields)
  const result = deserializeSave(wrong, bytes)
  assert.equal(result.ok, false)
  assert.match(result.reason, /version mismatch/)
})

test("detects corrupted save data via checksum", () => {
  const bytes = serializeSave(SCHEMA, { level: 1, health: 1, coins: 1, flags: new Array(32).fill(0) })
  bytes[2] ^= 0xff
  const result = deserializeSave(SCHEMA, bytes)
  assert.equal(result.ok, false)
  assert.match(result.reason, /checksum/)
})

test("initializes SaveData fields to defaults", () => {
  const data = new SaveData(SCHEMA)
  assert.equal(data.data.level, 0)
  assert.equal(data.data.flags.length, 32)
})

test("migrates saves across schema versions", () => {
  const migrations = [[1, 2, old => ({ ...old, difficulty: 1 })]]
  const data = { level: 2, health: 50 }
  const migrated = migrateSave({ version: 1 }, data, migrations)
  assert.equal(migrated.difficulty, 1)
  assert.equal(migrated.level, 2)
})

test("checksum16 is stable and order-sensitive", () => {
  assert.equal(checksum16([1, 2, 3]), checksum16([1, 2, 3]))
  assert.notEqual(checksum16([1, 2, 3]), checksum16([3, 2, 1]))
})
