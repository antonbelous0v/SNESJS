import { DiagnosticBag } from "./contracts/diagnostics.js"
import { Lexer } from "./lexer.js"
import { Parser } from "./parser.js"
import { TypeInferrer } from "./analyzer.js"

export class CompilationResult {
  constructor({ source, ast, diagnostics }) {
    this.source = source
    this.ast = ast
    this.diagnostics = diagnostics
  }

  get hasErrors() {
    return this.diagnostics.hasErrors()
  }

  formatDiagnostics() {
    return this.diagnostics.renderAll(this.source)
  }
}

export function compile(source) {
  const diagnostics = new DiagnosticBag()
  const tokens = new Lexer(source, diagnostics).tokenize()
  const ast = new Parser(source, diagnostics, tokens).parse()
  if (!diagnostics.hasErrors()) {
    new TypeInferrer(diagnostics).infer(ast)
  }
  return new CompilationResult({ source, ast, diagnostics })
}
