import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

export async function loadProject(root) {
  const configPath = path.join(root, "snes.config.js")
  const config = fs.existsSync(configPath) ? (await import(pathToFileURL(configPath).href)).default : {}

  return {
    root,
    config,
    name: config.name ?? path.basename(root),
    sourceFiles: discoverSources(root, config),
  }
}

function discoverSources(root, config) {
  const entry = config.entry ?? "src/main.js"
  const entryPath = path.join(root, entry)
  if (fs.existsSync(entryPath)) {
    return [entryPath]
  }
  return findJavaScriptFiles(path.join(root, "src"))
}

export function findJavaScriptFiles(directory) {
  if (!fs.existsSync(directory)) {
    return []
  }
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...findJavaScriptFiles(fullPath))
    } else if (entry.name.endsWith(".js")) {
      files.push(fullPath)
    }
  }
  return files.sort()
}
