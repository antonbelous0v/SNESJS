import { HARDWARE_BUDGETS, formatBytes } from "./resources.js"

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char])
}

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

  renderHtml() {
    const scenes = this.scenes.map((scene) => {
      const rows = Object.entries(scene.budgets).map(([key, budget]) => {
        const percent = Math.round(budget.utilization * 100)
        const status = budget.overBudget ? "over" : percent > 85 ? "warn" : "ok"
        return `<tr class="${status}"><td>${escapeHtml(budget.label)}</td><td>${budget.used}</td><td>${budget.limit}</td><td>${percent}%</td></tr>`
      }).join("")
      return `<section><h2>${escapeHtml(scene.scene.name)}</h2><table><thead><tr><th>Budget</th><th>Used</th><th>Limit</th><th>Utilization</th></tr></thead><tbody>${rows}</tbody></table></section>`
    }).join("")

    const warnings = this.warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join("")
    const rom = this.metrics.romBytes ? `<p>ROM size: ${formatBytes(this.metrics.romBytes)}</p>` : ""

    return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>SNESJS build report</title>
<style>
body { font-family: system-ui, sans-serif; margin: 2rem; color: #1a1a1a; }
table { border-collapse: collapse; margin-bottom: 2rem; }
td, th { border: 1px solid #ccc; padding: 0.4rem 1rem; text-align: right; }
th { background: #f0f0f0; }
tr.ok td:last-child { color: #1a7f37; }
tr.warn td:last-child { color: #9a6700; }
tr.over td:last-child { color: #cf222e; font-weight: 600; }
</style></head>
<body>
<h1>SNESJS build report</h1>
${rom}
${scenes}
${warnings ? `<h2>Warnings</h2><ul>${warnings}</ul>` : ""}
</body>
</html>`
  }
}
