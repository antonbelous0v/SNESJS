export const TokenKind = Object.freeze({
  Identifier: "Identifier",
  Keyword: "Keyword",
  Number: "Number",
  String: "String",
  Template: "Template",
  Punctuator: "Punctuator",
  Operator: "Operator",
  Eof: "Eof",
})

export class Token {
  constructor(kind, value, span, extra = {}) {
    this.kind = kind
    this.value = value
    this.span = span
    Object.assign(this, extra)
  }
}

export const KEYWORDS = new Set([
  "const", "let", "var", "if", "else", "switch", "case", "default",
  "for", "while", "do", "break", "continue", "return", "function",
  "class", "new", "this", "super", "extends", "import", "export", "from",
  "as", "true", "false", "null", "undefined", "typeof", "delete", "in", "of",
])

export const KEYWORD_VALUES = new Map([
  ["true", true],
  ["false", false],
  ["null", null],
])

export class TokenCursor {
  constructor(tokens) {
    this.tokens = tokens
    this.position = 0
  }

  current() {
    return this.tokens[this.position]
  }

  previous() {
    return this.tokens[this.position - 1]
  }

  take() {
    return this.tokens[this.position++]
  }

  atKind(kind) {
    return this.current().kind === kind
  }

  atValue(value) {
    return this.current().value === value
  }

  atKeyword(value) {
    return this.current().kind === TokenKind.Keyword && this.current().value === value
  }

  atPunctuator(value) {
    return this.current().kind === TokenKind.Punctuator && this.current().value === value
  }

  atOperator(value) {
    return this.current().kind === TokenKind.Operator && this.current().value === value
  }

  matchKind(kind) {
    if (!this.atKind(kind)) {
      return false
    }
    this.position += 1
    return true
  }

  matchValue(value) {
    if (!this.atValue(value)) {
      return false
    }
    this.position += 1
    return true
  }

  matchKeyword(value) {
    if (!this.atKeyword(value)) {
      return false
    }
    this.position += 1
    return true
  }

  matchPunctuator(value) {
    if (!this.atPunctuator(value)) {
      return false
    }
    this.position += 1
    return true
  }

  matchOperator(value) {
    if (!this.atOperator(value)) {
      return false
    }
    this.position += 1
    return true
  }

  expectIdentifier() {
    const token = this.current()
    if (token.kind !== TokenKind.Identifier && token.kind !== TokenKind.Keyword) {
      throw new Error(`Expected identifier, received ${token.value}`)
    }
    this.position += 1
    return token
  }

  expectKeyword(value) {
    if (!this.matchKeyword(value)) {
      throw new Error(`Expected ${value}, received ${this.current().value}`)
    }
    return this.previous()
  }

  expectString() {
    const token = this.current()
    if (token.kind !== TokenKind.String) {
      throw new Error(`Expected string literal, received ${token.value}`)
    }
    this.position += 1
    return token.value
  }

  expectPunctuator(value) {
    if (!this.matchPunctuator(value)) {
      throw new Error(`Expected ${value}, received ${this.current().value}`)
    }
    return this.previous()
  }
}
