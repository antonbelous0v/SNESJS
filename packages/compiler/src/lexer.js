import { SourceLocation } from "./contracts/diagnostics.js"
import { DiagnosticBag } from "./contracts/diagnostics.js"
import { Token, TokenKind, KEYWORDS, KEYWORD_VALUES } from "./contracts/tokens.js"

export class Lexer {
  constructor(source, diagnostics = new DiagnosticBag()) {
    this.source = source
    this.diagnostics = diagnostics
    this.length = source.length
    this.position = 0
    this.line = 1
    this.column = 1
    this.locations = []
  }

  tokenize() {
    const tokens = []
    for (;;) {
      this.skipTrivia()
      if (this.position >= this.length) {
        tokens.push(new Token(TokenKind.Eof, null, this.span()))
        return tokens
      }
      tokens.push(this.nextToken())
    }
  }

  nextToken() {
    const start = this.position
    const char = this.source[this.position]
    const code = this.source.charCodeAt(this.position)

    if (isIdentifierStart(code)) {
      return this.identifier(start)
    }
    if (isDigit(code) || (char === "." && isDigit(this.source.charCodeAt(this.position + 1)))) {
      return this.number(start)
    }
    if (char === "'" || char === "\"") {
      return this.string(start, char)
    }
    if (char === "`") {
      return this.template(start)
    }
    return this.punctuatorOrOperator(start)
  }

  identifier(start) {
    this.advance()
    while (this.position < this.length && isIdentifierPart(this.source.charCodeAt(this.position))) {
      this.advance()
    }
    const raw = this.source.slice(start, this.position)
    const span = this.spanFrom(start)
    if (KEYWORDS.has(raw)) {
      return new Token(TokenKind.Keyword, KEYWORD_VALUES.has(raw) ? KEYWORD_VALUES.get(raw) : raw, span)
    }
    return new Token(TokenKind.Identifier, raw, span)
  }

  number(start) {
    if (this.source[this.position] === "0") {
      const next = this.source[this.position + 1]
      if (next === "x" || next === "X") {
        this.advance()
        this.advance()
        return this.radixNumber(start, 16)
      }
      if (next === "b" || next === "B") {
        this.advance()
        this.advance()
        return this.radixNumber(start, 2)
      }
      if (next === "o" || next === "O") {
        this.advance()
        this.advance()
        return this.radixNumber(start, 8)
      }
    }

    while (this.position < this.length && isDigit(this.source.charCodeAt(this.position))) {
      this.advance()
    }
    let isFloat = false
    if (this.source[this.position] === ".") {
      isFloat = true
      this.advance()
      while (this.position < this.length && isDigit(this.source.charCodeAt(this.position))) {
        this.advance()
      }
    }
    if (this.source[this.position] === "e" || this.source[this.position] === "E") {
      isFloat = true
      this.advance()
      if (this.source[this.position] === "+" || this.source[this.position] === "-") {
        this.advance()
      }
      while (this.position < this.length && isDigit(this.source.charCodeAt(this.position))) {
        this.advance()
      }
    }

    const raw = this.source.slice(start, this.position)
    const value = isFloat ? Number(raw) : Number.parseInt(raw, 10)
    return new Token(TokenKind.Number, value, this.spanFrom(start), { raw, isFloat })
  }

  radixNumber(start, radix) {
    const digitStart = this.position
    while (this.position < this.length && isRadixDigit(this.source[this.position], radix)) {
      this.advance()
    }
    if (this.position === digitStart) {
      this.diagnostics.error("E1101", `Expected ${radix} digits after numeric literal prefix`, this.spanFrom(start))
      return new Token(TokenKind.Number, 0, this.spanFrom(start), { raw: this.source.slice(start, this.position), isFloat: false })
    }
    const raw = this.source.slice(start, this.position)
    const value = Number.parseInt(raw.slice(2), radix)
    return new Token(TokenKind.Number, value, this.spanFrom(start), { raw, isFloat: false })
  }

  string(start, quote) {
    this.advance()
    let value = ""
    for (;;) {
      if (this.position >= this.length) {
        this.diagnostics.error("E1101", "Unterminated string literal", this.spanFrom(start))
        return new Token(TokenKind.String, value, this.spanFrom(start))
      }
      const char = this.source[this.position]
      if (char === quote) {
        this.advance()
        return new Token(TokenKind.String, value, this.spanFrom(start))
      }
      if (char === "\\") {
        value += this.escapeSequence()
        continue
      }
      value += char
      this.advance()
    }
  }

  escapeSequence() {
    this.advance()
    if (this.position >= this.length) {
      this.diagnostics.error("E1101", "Unterminated escape sequence", this.span())
      return ""
    }
    const char = this.source[this.position]
    const escapes = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", 0: "\0" }
    if (char in escapes) {
      this.advance()
      return escapes[char]
    }
    if (char === "u") {
      this.advance()
      const hex = this.source.slice(this.position, this.position + 4)
      if (hex.length !== 4 || !/^[0-9a-fA-F]{4}$/.test(hex)) {
        this.diagnostics.error("E1101", "Invalid unicode escape sequence", this.span())
        return ""
      }
      for (let index = 0; index < 4; index += 1) {
        this.advance()
      }
      return String.fromCharCode(Number.parseInt(hex, 16))
    }
    this.advance()
    return char
  }

  template(start) {
    this.advance()
    let value = ""
    const expressions = []
    for (;;) {
      if (this.position >= this.length) {
        this.diagnostics.error("E1101", "Unterminated template literal", this.spanFrom(start))
        return new Token(TokenKind.Template, value, this.spanFrom(start), { expressions })
      }
      const char = this.source[this.position]
      if (char === "`") {
        this.advance()
        return new Token(TokenKind.Template, value, this.spanFrom(start), { expressions })
      }
      if (char === "$" && this.source[this.position + 1] === "{") {
        const expressionStart = this.position + 2
        this.advance()
        this.advance()
        const end = this.scanTemplateExpression(expressionStart)
        expressions.push({ start: expressionStart, end })
        this.position = end + 1
        value += "\u0000"
        continue
      }
      if (char === "\\") {
        value += this.escapeSequence()
        continue
      }
      value += char
      this.advance()
    }
  }

  scanTemplateExpression(start) {
    let depth = 1
    let position = this.position
    while (position < this.length) {
      const char = this.source[position]
      if (char === "{") {
        depth += 1
      } else if (char === "}") {
        depth -= 1
        if (depth === 0) {
          return position
        }
      } else if (char === "'" || char === "\"" || char === "`") {
        position = skipQuoted(this.source, position, char)
        continue
      }
      position += 1
    }
    this.diagnostics.error("E1101", "Unterminated template expression", this.spanFrom(start - 2))
    return this.length - 1
  }

  punctuatorOrOperator(start) {
    const rest = this.source.slice(this.position, this.position + 3)
    const candidates = ["===", "!==", ">>>", "**=", "...", "<<=", ">>=", "==", "!=", "<=", ">=", "&&", "||", "++", "--", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<", ">>", "=>", "??", "?."]
    for (const candidate of candidates) {
      if (rest.startsWith(candidate)) {
        for (let index = 0; index < candidate.length; index += 1) {
          this.advance()
        }
        const kind = "(){}[];,:.?".includes(candidate[0]) && candidate !== "??" && candidate !== "?." ? TokenKind.Punctuator : TokenKind.Operator
        return new Token(kind, candidate, this.spanFrom(start))
      }
    }
    const char = this.source[this.position]
    this.advance()
    const kind = "(){}[];,:.?".includes(char) ? TokenKind.Punctuator : TokenKind.Operator
    return new Token(kind, char, this.spanFrom(start))
  }

  skipTrivia() {
    for (;;) {
      while (this.position < this.length && isWhitespace(this.source.charCodeAt(this.position))) {
        this.advance()
      }
      if (this.source.startsWith("//", this.position)) {
        while (this.position < this.length && this.source[this.position] !== "\n") {
          this.advance()
        }
        continue
      }
      if (this.source.startsWith("/*", this.position)) {
        this.advance()
        this.advance()
        while (this.position < this.length && !this.source.startsWith("*/", this.position)) {
          this.advance()
        }
        this.advance()
        this.advance()
        continue
      }
      return
    }
  }

  advance() {
    const char = this.source[this.position]
    this.locations[this.position] = new SourceLocation(this.line, this.column, this.position)
    this.position += 1
    if (char === "\n") {
      this.line += 1
      this.column = 1
    } else {
      this.column += 1
    }
  }

  span() {
    const location = new SourceLocation(this.line, this.column, this.position)
    return { start: location, end: location }
  }

  spanFrom(start) {
    return { start: this.locationAt(start), end: this.locationAt(this.position) }
  }

  locationAt(position) {
    if (position === this.position) {
      return new SourceLocation(this.line, this.column, position)
    }
    if (this.locations[position]) {
      return this.locations[position]
    }
    let line = 1
    let column = 1
    for (let index = 0; index < position; index += 1) {
      if (this.source[index] === "\n") {
        line += 1
        column = 1
      } else {
        column += 1
      }
    }
    return new SourceLocation(line, column, position)
  }
}

export function tokenize(source, diagnostics = new DiagnosticBag()) {
  return new Lexer(source, diagnostics).tokenize()
}

function skipQuoted(source, start, quote) {
  let position = start + 1
  while (position < source.length) {
    const char = source[position]
    if (char === "\\") {
      position += 2
      continue
    }
    if (char === quote) {
      return position
    }
    position += 1
  }
  return position
}

function isDigit(code) {
  return code >= 48 && code <= 57
}

function isIdentifierStart(code) {
  return code >= 65 && code <= 90 || code >= 97 && code <= 122 || code === 95 || code === 36
}

function isIdentifierPart(code) {
  return isIdentifierStart(code) || isDigit(code)
}

function isWhitespace(code) {
  return code === 32 || code === 9 || code === 10 || code === 13 || code === 12 || code === 11
}

function isRadixDigit(char, radix) {
  const value = Number.parseInt(char, radix)
  return !Number.isNaN(value) && value < radix
}
