#!/usr/bin/env node
import { build, analyze, doctor } from "../src/commands.js"

const args = process.argv.slice(2)
const command = args[0] ?? "help"
const rootIndex = args.indexOf("--root")
const root = rootIndex >= 0 ? args[rootIndex + 1] : process.cwd()
const rest = args.filter(argument => argument !== "--root" && argument !== root)

switch (command) {
  case "build":
    await build(root)
    break
  case "analyze":
    await analyze(root)
    break
  case "doctor":
    process.exitCode = doctor() ? 0 : 1
    break
  case "test":
    process.stdout.write("Run host tests with: node --test packages/*/test/*.test.js\n")
    break
  case "help":
  default:
    printHelp()
    break
}

function printHelp() {
  process.stdout.write(`SNESJS toolchain

Usage:
  snes build      Compile JavaScript game code to generated C11
  snes analyze    Print hardware resource budgets for every scene
  snes doctor     Check the local toolchain (Node, OpenSNES, WLA-DX)
  snes test       Run the host-side test suite
`)
}
