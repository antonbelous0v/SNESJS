export class SourceLocation {
  constructor(line, column, offset) {
    this.line = line
    this.column = column
    this.offset = offset
  }
}

export class SourceSpan {
  constructor(start, end) {
    this.start = start
    this.end = end
  }

  toString() {
    return `${this.start.line}:${this.start.column}`
  }
}

export const DiagnosticSeverity = Object.freeze({
  Error: "error",
  Warning: "warning",
})

export class Diagnostic {
  constructor(code, message, span, severity = DiagnosticSeverity.Error, note = null) {
    this.code = code
    this.message = message
    this.span = span
    this.severity = severity
    this.note = note
  }

  render(source) {
    if (!this.span) {
      return `${this.code}: ${this.message}`
    }
    const start = this.span.start
    const lineText = readLine(source, start.line)
    const gutter = String(start.line).padStart(4, " ")
    const padding = " ".repeat(gutter.length)
    const caret = " ".repeat(Math.max(0, start.column - 1))
    let rendered = `${gutter} │ ${lineText}\n${padding} │ ${caret}^\n${this.code}: ${this.message}`
    if (this.note) {
      rendered += `\n\n  note: ${this.note}`
    }
    return rendered
  }
}

export class DiagnosticBag {
  constructor() {
    this.items = []
  }

  error(code, message, span, note = null) {
    this.items.push(new Diagnostic(code, message, span, DiagnosticSeverity.Error, note))
  }

  warning(code, message, span, note = null) {
    this.items.push(new Diagnostic(code, message, span, DiagnosticSeverity.Warning, note))
  }

  get errors() {
    return this.items.filter(diagnostic => diagnostic.severity === DiagnosticSeverity.Error)
  }

  get warnings() {
    return this.items.filter(diagnostic => diagnostic.severity === DiagnosticSeverity.Warning)
  }

  hasErrors() {
    return this.errors.length > 0
  }

  renderAll(source) {
    return this.items
      .map(diagnostic => `${diagnostic.severity === DiagnosticSeverity.Warning ? "warning " : ""}${diagnostic.render(source)}`)
      .join("\n\n")
  }
}

function readLine(source, line) {
  const lines = source.split("\n")
  return line >= 1 && line <= lines.length ? lines[line - 1] : ""
}
