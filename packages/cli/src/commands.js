import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

import { compile, generateC, ResourceAnalyzer, SceneResources, AssetResources, BuildReport } from "@snesjs/compiler"
import { loadProject } from "./project.js"

export async function build(root) {
  const project = await loadProject(root)
  const outputDirectory = path.join(root, "build", "generated")
  fs.mkdirSync(outputDirectory, { recursive: true })

  const generated = []
  for (const file of project.sourceFiles) {
    const source = fs.readFileSync(file, "utf8")
    const result = compile(source)
    if (result.hasErrors) {
      process.stderr.write(`\n${file}\n${result.formatDiagnostics()}\n`)
      return { success: false, generated }
    }
    const c = generateC(result.ast)
    const target = path.join(outputDirectory, path.basename(file, ".js") + ".gen.c")
    fs.writeFileSync(target, c)
    generated.push({ file, target })
    process.stdout.write(`✓ ${path.relative(root, file)}\n`)
  }

  const report = buildReport(project)
  fs.writeFileSync(path.join(root, "build", "report.json"), JSON.stringify(report.toJSON(), null, 2))
  process.stdout.write(`\n${report.renderText()}\n`)
  return { success: true, generated }
}

export async function analyze(root) {
  const project = await loadProject(root)
  const report = buildReport(project)
  process.stdout.write(`${report.renderText()}\n`)
  return report
}

export function doctor() {
  const checks = []
  checks.push(checkNode())
  checks.push(checkTool("cc65816", "OpenSNES compiler"))
  checks.push(checkTool("gcc", "host C compiler", checkTool("clang", "host C compiler")))
  checks.push(checkTool("wla-65816", "WLA-DX assembler"))

  for (const check of checks) {
    process.stdout.write(`${check.ok ? "✓" : "✗"} ${check.label}${check.detail ? ` (${check.detail})` : ""}\n`)
  }
  return checks.every(check => check.ok)
}

function buildReport(project) {
  const scenes = (project.config.scenes ?? []).map((scene) => {
    const resources = new SceneResources(scene.name)
    for (const asset of scene.assets ?? []) {
      resources.add(new AssetResources({
        type: asset.type ?? "sprite",
        name: asset.name,
        vramBytes: asset.vramBytes ?? asset.tiles * 32,
        cgramColors: asset.colors ?? 16,
        oamSprites: asset.sprites ?? 0,
      }))
    }
    return new ResourceAnalyzer().analyze(resources)
  })
  return new BuildReport({ scenes, warnings: project.config.warnings ?? [] })
}

function checkNode() {
  const version = process.versions.node
  const major = Number.parseInt(version.split(".")[0], 10)
  return { ok: major >= 20, label: "Node", detail: `v${version}` }
}

function checkTool(command, label, fallback = null) {
  try {
    const output = execFileSync(command, ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
    return { ok: true, label, detail: output.split("\n")[0] }
  } catch {
    if (fallback) {
      return fallback()
    }
    return { ok: false, label, detail: "not found" }
  }
}
