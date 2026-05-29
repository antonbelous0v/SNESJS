import { DiagnosticBag } from "./contracts/diagnostics.js"

export const HARDWARE_BUDGETS = Object.freeze({
  vramBytes: 65536,
  cgramColors: 256,
  cgramBytes: 512,
  oamSprites: 128,
  oamBytes: 544,
  wramBytes: 131072,
  spcRamBytes: 65536,
})

export class ResourceBudget {
  constructor({ used, limit, label }) {
    this.used = used
    this.limit = limit
    this.label = label
  }

  get available() {
    return this.limit - this.used
  }

  get utilization() {
    return this.limit === 0 ? 0 : this.used / this.limit
  }

  get overBudget() {
    return this.used > this.limit
  }
}

export class SceneResources {
  constructor(name) {
    this.name = name
    this.assets = []
  }

  add(asset) {
    this.assets.push(asset)
    return this
  }
}

export class AssetResources {
  constructor({ type, name, vramBytes = 0, cgramColors = 0, oamSprites = 0, wramBytes = 0, spcBytes = 0 }) {
    this.type = type
    this.name = name
    this.vramBytes = vramBytes
    this.cgramColors = cgramColors
    this.oamSprites = oamSprites
    this.wramBytes = wramBytes
    this.spcBytes = spcBytes
  }
}

export class ResourceAnalyzer {
  constructor(diagnostics = new DiagnosticBag()) {
    this.diagnostics = diagnostics
  }

  analyze(scene) {
    const usage = scene.assets.reduce((total, asset) => {
      total.vram += asset.vramBytes
      total.cgram += asset.cgramColors
      total.oam += asset.oamSprites
      total.wram += asset.wramBytes
      total.spc += asset.spcBytes
      return total
    }, { vram: 0, cgram: 0, oam: 0, wram: 0, spc: 0 })

    const budgets = {
      vram: new ResourceBudget({ used: usage.vram, limit: HARDWARE_BUDGETS.vramBytes, label: "VRAM" }),
      cgram: new ResourceBudget({ used: usage.cgram, limit: HARDWARE_BUDGETS.cgramColors, label: "CGRAM colors" }),
      oam: new ResourceBudget({ used: usage.oam, limit: HARDWARE_BUDGETS.oamSprites, label: "OAM sprites" }),
      wram: new ResourceBudget({ used: usage.wram, limit: HARDWARE_BUDGETS.wramBytes, label: "WRAM" }),
      spc: new ResourceBudget({ used: usage.spc, limit: HARDWARE_BUDGETS.spcRamBytes, label: "SPC RAM" }),
    }

    this.reportOverBudget(budgets, scene)
    return { scene, usage, budgets }
  }

  reportOverBudget(budgets, scene) {
    for (const [key, budget] of Object.entries(budgets)) {
      if (budget.overBudget) {
        this.diagnostics.error(
          "E4201",
          `${budget.label} budget exceeded in scene "${scene.name}" (${budget.used} > ${budget.limit})`,
          null,
          `required ${budget.used}, available ${budget.limit}`,
        )
      }
    }
  }
}

export function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`
  }
  return `${bytes} B`
}
