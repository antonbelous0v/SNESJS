import { NodeKind, walk } from "./ast.js"

export class SourceMapEntry {
  constructor({ generatedLine, sourceLine, sourceColumn, symbol, name }) {
    this.generatedLine = generatedLine
    this.sourceLine = sourceLine
    this.sourceColumn = sourceColumn
    this.symbol = symbol
    this.name = name
  }
}

export class SourceMapGenerator {
  constructor(source) {
    this.source = source
    this.entries = []
    this.generatedLine = 0
  }

  mapNode(node, name = null) {
    if (!node || !node.span) {
      return
    }
    this.entries.push(new SourceMapEntry({
      generatedLine: this.generatedLine,
      sourceLine: node.span.start.line,
      sourceColumn: node.span.start.column,
      symbol: name ?? nodeSymbolName(node),
      name,
    }))
  }

  markGeneratedLine() {
    this.generatedLine += 1
  }

  toJSON(sourceFile = "main.js") {
    const sorted = [...this.entries].sort((a, b) => a.generatedLine - b.generatedLine || a.sourceLine - b.sourceLine)
    return {
      version: 3,
      file: sourceFile,
      sources: [sourceFile],
      mappings: sorted.map(entry => ({
        generatedLine: entry.generatedLine,
        sourceLine: entry.sourceLine,
        sourceColumn: entry.sourceColumn,
        symbol: entry.symbol,
        name: entry.name,
      })),
    }
  }

  resolve(program, address, symbolTable = {}) {
    const entry = [...this.entries].reverse().find(item => item.name === address || item.symbol === address || item.symbol === symbolTable[address])
    if (!entry) {
      return null
    }
    return {
      line: entry.sourceLine,
      column: entry.sourceColumn,
      symbol: entry.name ?? entry.symbol,
    }
  }
}

function nodeSymbolName(node) {
  switch (node.kind) {
    case NodeKind.FunctionDeclaration:
      return node.id ? node.id.name : "<function>"
    case NodeKind.ClassDeclaration:
      return node.id.name
    case NodeKind.MethodDefinition:
      return `${node.key}`
    case NodeKind.VariableDeclarator:
      return node.id.kind === NodeKind.Identifier ? node.id.name : "<binding>"
    default:
      return null
  }
}

export function buildSourceMap(ast, sourceFile = "main.js") {
  const generator = new SourceMapGenerator()
  walk(ast, node => {
    if (node.kind === NodeKind.VariableDeclarator) {
      generator.mapNode(node, node.id.kind === NodeKind.Identifier ? node.id.name : "<binding>")
      return
    }
    if (node.kind === NodeKind.MethodDefinition) {
      generator.mapNode(node, node.key)
      return
    }
    const name = nodeSymbolName(node)
    if (name) {
      generator.mapNode(node, name)
    }
  })
  return generator
}
