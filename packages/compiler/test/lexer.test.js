import test from "node:test"
import assert from "node:assert/strict"

import { tokenize } from "../src/lexer.js"
import { TokenKind } from "../src/contracts/tokens.js"
import { DiagnosticBag } from "../src/contracts/diagnostics.js"

test("tokenizes identifiers and keywords", () => {
  const tokens = tokenize("const player = 3")
  assert.equal(tokens[0].kind, TokenKind.Keyword)
  assert.equal(tokens[0].value, "const")
  assert.equal(tokens[1].kind, TokenKind.Identifier)
  assert.equal(tokens[1].value, "player")
  assert.equal(tokens[2].kind, TokenKind.Operator)
  assert.equal(tokens[2].value, "=")
  assert.equal(tokens[3].kind, TokenKind.Number)
  assert.equal(tokens[3].value, 3)
  assert.equal(tokens[4].kind, TokenKind.Eof)
})

test("parses decimal, hex, binary, octal and float literals", () => {
  const tokens = tokenize("0xff 0b1010 0o17 3.5 1e3")
  assert.equal(tokens[0].value, 255)
  assert.equal(tokens[1].value, 10)
  assert.equal(tokens[2].value, 15)
  assert.equal(tokens[3].value, 3.5)
  assert.equal(tokens[3].isFloat, true)
  assert.equal(tokens[4].value, 1000)
})

test("handles string escapes and unicode", () => {
  const tokens = tokenize("\"a\\nb\" '\\u0041'")
  assert.equal(tokens[0].value, "a\nb")
  assert.equal(tokens[1].value, "A")
})

test("classifies assignment and arrow operators", () => {
  const tokens = tokenize("x -= 1 => ??")
  assert.equal(tokens[1].kind, TokenKind.Operator)
  assert.equal(tokens[1].value, "-=")
  assert.equal(tokens[3].kind, TokenKind.Operator)
  assert.equal(tokens[3].value, "=>")
})

test("tracks line and column positions", () => {
  const tokens = tokenize("let a = 1\nlet b = 2")
  const bToken = tokens.find(token => token.value === "b")
  assert.equal(bToken.span.start.line, 2)
  assert.equal(bToken.span.start.column, 5)
})

test("records a diagnostic for unterminated strings", () => {
  const diagnostics = new DiagnosticBag()
  const tokens = tokenize("\"oops", diagnostics)
  assert.equal(tokens[0].kind, TokenKind.String)
  assert.equal(diagnostics.errors.length, 1)
  assert.equal(diagnostics.errors[0].code, "E1101")
})
