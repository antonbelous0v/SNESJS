import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

const RUNTIME_C = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../compiler/runtime/snesjs_runtime.c")
const RUNTIME_H = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../compiler/include/snesjs_runtime.h")

export function findSdk(root) {
  if (process.env.SNESJS_SDK && fs.existsSync(path.join(process.env.SNESJS_SDK, "bin", "cc65816"))) {
    return process.env.SNESJS_SDK
  }
  let directory = path.resolve(root)
  for (;;) {
    const vendored = path.join(directory, "vendor", "opensnes")
    if (fs.existsSync(path.join(vendored, "bin", "cc65816"))) {
      return vendored
    }
    const parent = path.dirname(directory)
    if (parent === directory) {
      return null
    }
    directory = parent
  }
}

export function buildRom(root, generatedC, { name = "SNESJS GAME", assets = [] } = {}) {
  const sdk = findSdk(root)
  if (!sdk) {
    return { ok: false, reason: "OpenSNES SDK not found — run scripts/install-sdk.sh" }
  }

  const romDirectory = path.join(root, "build", "rom")
  fs.rmSync(romDirectory, { recursive: true, force: true })
  fs.mkdirSync(romDirectory, { recursive: true })

  const converted = convertAssets(root, romDirectory, sdk, assets)

  fs.writeFileSync(path.join(romDirectory, "main.c"), generatedC)
  fs.copyFileSync(RUNTIME_C, path.join(romDirectory, "snesjs_runtime.c"))
  fs.copyFileSync(RUNTIME_H, path.join(romDirectory, "snesjs_runtime.h"))
  fs.writeFileSync(path.join(romDirectory, "data.asm"), dataAsm(converted))
  fs.writeFileSync(path.join(romDirectory, "assets.c"), assetsC(converted))
  fs.writeFileSync(path.join(romDirectory, "Makefile"), makefile(sdk, name))

  const makeOutput = execFileSync("make", ["-C", romDirectory], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })

  const sfc = path.join(romDirectory, "game.sfc")
  const sym = path.join(romDirectory, "game.sym")
  if (!fs.existsSync(sfc)) {
    return { ok: false, reason: `ROM build failed:\n${makeOutput.slice(-2000)}` }
  }

  const distDirectory = path.join(root, "dist")
  fs.mkdirSync(distDirectory, { recursive: true })
  fixChecksum(sfc)
  fs.copyFileSync(sfc, path.join(distDirectory, "game.sfc"))
  if (fs.existsSync(sym)) {
    fs.copyFileSync(sym, path.join(distDirectory, "game.sym"))
  }

  return { ok: true, sfc: path.join(distDirectory, "game.sfc"), sym: path.join(distDirectory, "game.sym"), size: fs.readFileSync(sfc).length, makeOutput }
}

function convertAssets(root, romDirectory, sdk, assets) {
  const gfx4snes = path.join(sdk, "bin", "gfx4snes")
  const converted = []
  for (const asset of assets) {
    const source = path.join(root, asset.file)
    const base = path.basename(asset.file, path.extname(asset.file))
    const png = path.join(romDirectory, `${base}.png`)
    fs.copyFileSync(source, png)
    execFileSync(gfx4snes, ["-s", String(asset.size ?? 16), "-p", "-i", png], { stdio: ["ignore", "ignore", "ignore"] })
    converted.push({ name: base, tileBase: asset.tileBase ?? converted.length * 32, paletteBase: asset.paletteBase ?? converted.length, pic: `${base}.pic`, pal: `${base}.pal` })
  }
  return converted
}

function dataAsm(assets) {
  const lines = [`.section ".rodata1" superfree`, ""]
  for (const asset of assets) {
    lines.push(`${asset.name}_til:`)
    lines.push(`.incbin "${asset.pic}"`)
    lines.push(`${asset.name}_tilend:`)
    lines.push("")
    lines.push(`${asset.name}_pal:`)
    lines.push(`.incbin "${asset.pal}"`)
    lines.push(`${asset.name}_palend:`)
    lines.push("")
  }
  lines.push(".ends")
  return lines.join("\n")
}

function assetsC(assets) {
  const lines = [`#include <snes.h>`, ""]
  for (const asset of assets) {
    lines.push(`extern u8 ${asset.name}_til[], ${asset.name}_tilend[];`)
    lines.push(`extern u8 ${asset.name}_pal[], ${asset.name}_palend[];`)
  }
  lines.push("")
  lines.push(`void sj_assets_load(void) {`)
  for (const asset of assets) {
    lines.push(`    dmaCopyVram(${asset.name}_til, ${asset.tileBase * 16}, ${asset.name}_tilend - ${asset.name}_til);`)
    lines.push(`    dmaCopyCGram(${asset.name}_pal, OBJ_CGRAM_BASE + ${asset.paletteBase * 16}, 32);`)
  }
  lines.push(`}`)
  return lines.join("\n")
}

function fixChecksum(sfcPath) {
  const bytes = fs.readFileSync(sfcPath)
  const headerOffset = 0x7FC0
  if (headerOffset + 0x20 > bytes.length) {
    return
  }
  bytes[headerOffset + 0x1C] = 0
  bytes[headerOffset + 0x1D] = 0
  bytes[headerOffset + 0x1E] = 0
  bytes[headerOffset + 0x1F] = 0
  let sum = 0
  for (const byte of bytes) {
    sum += byte
  }
  sum &= 0xFFFF
  const complement = (~sum) & 0xFFFF
  bytes[headerOffset + 0x1C] = complement & 0xFF
  bytes[headerOffset + 0x1D] = (complement >> 8) & 0xFF
  bytes[headerOffset + 0x1E] = sum & 0xFF
  bytes[headerOffset + 0x1F] = (sum >> 8) & 0xFF
  fs.writeFileSync(sfcPath, bytes)
}

function makefile(sdk, name) {
  return `OPENSNES ?= ${sdk}

TARGET   := game.sfc
ROM_NAME := ${String(name).slice(0, 21)}

USE_LIB     := 1
LIB_MODULES := console dma sprite input background

CSRC   := main.c snesjs_runtime.c assets.c
ASMSRC := data.asm

include $(OPENSNES)/make/common.mk
`
}
