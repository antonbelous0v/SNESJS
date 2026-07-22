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

export function buildRom(root, generatedC, { name = "SNESJS GAME" } = {}) {
  const sdk = findSdk(root)
  if (!sdk) {
    return { ok: false, reason: "OpenSNES SDK not found — run scripts/install-sdk.sh" }
  }

  const romDirectory = path.join(root, "build", "rom")
  fs.rmSync(romDirectory, { recursive: true, force: true })
  fs.mkdirSync(romDirectory, { recursive: true })

  fs.writeFileSync(path.join(romDirectory, "main.c"), generatedC)
  fs.copyFileSync(RUNTIME_C, path.join(romDirectory, "snesjs_runtime.c"))
  fs.copyFileSync(RUNTIME_H, path.join(romDirectory, "snesjs_runtime.h"))
  fs.writeFileSync(path.join(romDirectory, "Makefile"), makefile(sdk, name))

  const makeOutput = execFileSync("make", ["-C", romDirectory], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })

  const sfc = path.join(romDirectory, "game.sfc")
  const sym = path.join(romDirectory, "game.sym")
  if (!fs.existsSync(sfc)) {
    return { ok: false, reason: `ROM build failed:\n${makeOutput.slice(-2000)}` }
  }

  const distDirectory = path.join(root, "dist")
  fs.mkdirSync(distDirectory, { recursive: true })
  fs.copyFileSync(sfc, path.join(distDirectory, "game.sfc"))
  if (fs.existsSync(sym)) {
    fs.copyFileSync(sym, path.join(distDirectory, "game.sym"))
  }

  const bytes = fs.readFileSync(sfc)
  return { ok: true, sfc: path.join(distDirectory, "game.sfc"), sym: path.join(distDirectory, "game.sym"), size: bytes.length, makeOutput }
}

function makefile(sdk, name) {
  return `OPENSNES ?= ${sdk}

TARGET   := game.sfc
ROM_NAME := ${String(name).slice(0, 21)}

USE_LIB     := 1
LIB_MODULES := console dma sprite input background

CSRC   := main.c snesjs_runtime.c

include $(OPENSNES)/make/common.mk
`
}
