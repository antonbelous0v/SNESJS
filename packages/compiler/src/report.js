import { HARDWARE_BUDGETS, formatBytes } from "./resources.js"

export class BuildReport {
  constructor({ scenes = [], warnings = [], metrics = {} }) {
    this.scenes = scenes
    this.warnings = warnings
    this.metrics = metrics
  }

  renderText() {
    const lines = []
    lines.push("SNESJS build report")
    lines.push("")
    for (const scene of this.scenes) {
      lines.push(`SCENE ${scene.scene.name.toUpperCase()}`)
      for (const [key, budget] of Object.entries(scene.budgets)) {
        const unit = budget.label.includes("color") || budget.label.includes("sprite") ? "" : " bytes"
        lines.push(`  ${budget.label.padEnd(16)} ${String(budget.used).padStart(6)} / ${budget.limit}${unit}`)
      }
      lines.push("")
    }
    for (const warning of this.warnings) {
      lines.push(`WARNING ${warning}`)
    }
    if (this.metrics.romBytes) {
      lines.push(`ROM size ${formatBytes(this.metrics.romBytes)}`)
    }
    return lines.join("\n")
  }

  toJSON() {
    return {
      scenes: this.scenes.map(scene => ({
        name: scene.scene.name,
        budgets: Object.fromEntries(Object.entries(scene.budgets).map(([key, budget]) => [key, { used: budget.used, limit: budget.limit, utilization: budget.utilization }])),
      })),
      warnings: this.warnings,
      metrics: this.metrics,
      hardware: HARDWARE_BUDGETS,
    }
  }
}
