import { DiagnosticBag } from "./contracts/diagnostics.js"
import { TokenCursor } from "./contracts/tokens.js"
import { Lexer } from "./lexer.js"
import { NodeKind, make } from "./ast.js"

const PRECEDENCE = {
  "||": 1,
  "??": 1,
  "&&": 2,
  "|": 3,
  "^": 4,
  "&": 5,
  "==": 6,
  "!=": 6,
  "===": 6,
  "!==": 6,
  "<": 7,
  ">": 7,
  "<=": 7,
  ">=": 7,
  "in": 7,
  "<<": 8,
  ">>": 8,
  ">>>": 8,
  "+": 9,
  "-": 9,
  "*": 10,
  "/": 10,
  "%": 10,
  "**": 11,
}

const ASSIGNMENT_OPERATORS = new Set(["=", "+=", "-=", "*=", "/=", "%=", "<<=", ">>=", ">>>=", "&=", "|=", "^=", "**="])

export class Parser {
  constructor(source, diagnostics = new DiagnosticBag(), tokens = null) {
    this.source = source
    this.diagnostics = diagnostics
    this.cursor = new TokenCursor(tokens ?? new Lexer(source, diagnostics).tokenize())
  }

  parse() {
    const statements = []
    while (!this.cursor.atKind("Eof")) {
      statements.push(this.statement())
    }
    return make(NodeKind.Program, { start: this.cursor.current().span.start, end: this.cursor.previous().span.end }, { statements })
  }

  parseExpression() {
    const program = this.parse()
    const first = program.statements[0]
    if (!first || first.kind !== NodeKind.ExpressionStatement) {
      this.diagnostics.error("E1101", "Expected an expression", this.cursor.current().span)
      return make(NodeKind.Literal, this.cursor.current().span, { value: null })
    }
    return first.expression
  }

  statement() {
    const token = this.cursor.current()
    if (this.cursor.atPunctuator("{")) {
      return this.blockStatement()
    }
    if (token.kind !== "Keyword") {
      return this.expressionStatement()
    }
    switch (token.value) {
      case "import":
        return this.importDeclaration()
      case "export":
        return this.exportDeclaration()
      case "const":
      case "let":
      case "var":
        return this.variableDeclaration()
      case "function":
        return this.functionDeclaration()
      case "class":
        return this.classDeclaration()
      case "if":
        return this.ifStatement()
      case "while":
        return this.whileStatement()
      case "do":
        return this.doWhileStatement()
      case "for":
        return this.forStatement()
      case "switch":
        return this.switchStatement()
      case "return":
        return this.returnStatement()
      case "break":
        return this.breakStatement()
      case "continue":
        return this.continueStatement()
      case "block":
        return this.blockStatement()
      default:
        return this.expressionStatement()
    }
  }

  importDeclaration() {
    const start = this.cursor.expectKeyword("import").span.start
    const specifiers = []
    if (this.cursor.matchValue("*")) {
      const name = this.cursor.matchKeyword("as") ? this.cursor.expectIdentifier().value : null
      specifiers.push({ kind: "namespace", name })
    } else if (this.cursor.matchPunctuator("{")) {
      while (!this.cursor.matchPunctuator("}")) {
        const imported = this.cursor.expectIdentifier().value
        const local = this.cursor.matchKeyword("as") ? this.cursor.expectIdentifier().value : imported
        specifiers.push({ kind: "named", imported, local })
        if (!this.cursor.matchPunctuator(",")) {
          this.cursor.expectPunctuator("}")
          break
        }
      }
    } else {
      specifiers.push({ kind: "default", local: this.cursor.expectIdentifier().value })
    }
    this.cursor.expectKeyword("from")
    const source = this.cursor.expectString()
    this.consumeSemicolon()
    return make(NodeKind.ImportDeclaration, { start, end: this.cursor.previous().span.end }, { source, specifiers })
  }

  exportDeclaration() {
    const start = this.cursor.expectKeyword("export").span.start
    if (this.cursor.matchKeyword("default")) {
      const declaration = this.expression()
      this.consumeSemicolon()
      return make(NodeKind.ExportDeclaration, { start, end: this.cursor.previous().span.end }, { declaration, isDefault: true })
    }
    if (this.cursor.matchPunctuator("{")) {
      const specifiers = []
      while (!this.cursor.matchPunctuator("}")) {
        const local = this.cursor.expectIdentifier().value
        const exported = this.cursor.matchKeyword("as") ? this.cursor.expectIdentifier().value : local
        specifiers.push({ local, exported })
        if (!this.cursor.matchPunctuator(",")) {
          this.cursor.expectPunctuator("}")
          break
        }
      }
      this.consumeSemicolon()
      return make(NodeKind.ExportDeclaration, { start, end: this.cursor.previous().span.end }, { specifiers, isDefault: false })
    }
    const declaration = this.statement()
    return make(NodeKind.ExportDeclaration, { start, end: declaration.span.end }, { declaration, isDefault: false })
  }

  variableDeclaration() {
    return this.parseVariableDeclaration(true)
  }

  forVariableDeclaration() {
    return this.parseVariableDeclaration(false)
  }

  parseVariableDeclaration(consumeSemicolon) {
    const start = this.cursor.take().span.start
    const keyword = this.cursor.previous().value
    const declarations = []
    do {
      const id = this.parseBinding()
      let init = null
      if (this.cursor.matchOperator("=")) {
        init = this.assignment()
      }
      declarations.push(make(NodeKind.VariableDeclarator, { start: id.span.start, end: init ? init.span.end : id.span.end }, { id, init }))
    } while (this.cursor.matchPunctuator(","))
    if (consumeSemicolon) {
      this.consumeSemicolon()
    }
    return make(NodeKind.VariableDeclaration, { start, end: this.cursor.previous().span.end }, { keyword, declarations })
  }

  parseBinding() {
    const token = this.cursor.current()
    if (token.kind === "Identifier") {
      return this.identifier()
    }
    if (this.cursor.matchPunctuator("{")) {
      const properties = []
      while (!this.cursor.matchPunctuator("}")) {
        const keyToken = this.cursor.expectIdentifier()
        const value = this.cursor.matchPunctuator(":") ? this.parseBinding() : this.identifierFrom(keyToken)
        properties.push(make(NodeKind.Property, { start: value.span.start, end: value.span.end }, { key: keyToken.value, value, shorthand: true }))
        if (!this.cursor.matchPunctuator(",")) {
          this.cursor.expectPunctuator("}")
          break
        }
      }
      return make(NodeKind.ObjectExpression, { start: token.span.start, end: this.cursor.previous().span.end }, { properties })
    }
    if (this.cursor.matchPunctuator("[")) {
      const elements = []
      while (!this.cursor.matchPunctuator("]")) {
        elements.push(this.parseBinding())
        if (!this.cursor.matchPunctuator(",")) {
          this.cursor.expectPunctuator("]")
          break
        }
      }
      return make(NodeKind.ArrayExpression, { start: token.span.start, end: this.cursor.previous().span.end }, { elements })
    }
    this.diagnostics.error("E1100", `Expected binding pattern, received ${token.value}`, token.span)
    return make(NodeKind.Identifier, token.span, { name: token.value })
  }

  functionDeclaration() {
    const start = this.cursor.expectKeyword("function").span.start
    const id = this.identifier()
    return this.finishFunction(NodeKind.FunctionDeclaration, start, id)
  }

  finishFunction(kind, start, id) {
    this.cursor.expectPunctuator("(")
    const params = []
    while (!this.cursor.matchPunctuator(")")) {
      params.push(this.parseBinding())
      if (!this.cursor.matchPunctuator(",")) {
        this.cursor.expectPunctuator(")")
        break
      }
    }
    const body = this.blockStatement()
    return make(kind, { start, end: body.span.end }, { id, params, body })
  }

  classDeclaration() {
    const start = this.cursor.expectKeyword("class").span.start
    const id = this.identifier()
    let superClass = null
    if (this.cursor.matchKeyword("extends")) {
      superClass = this.identifier()
    }
    this.cursor.expectPunctuator("{")
    const methods = []
    while (!this.cursor.matchPunctuator("}")) {
      const isStatic = this.cursor.matchKeyword("static")
      const keyToken = this.cursor.expectIdentifier()
      const value = this.finishFunction(NodeKind.FunctionExpression, keyToken.span.start, null)
      methods.push(make(NodeKind.MethodDefinition, { start: keyToken.span.start, end: value.span.end }, { key: keyToken.value, value, isStatic }))
    }
    return make(NodeKind.ClassDeclaration, { start, end: this.cursor.previous().span.end }, { id, superClass, methods })
  }

  ifStatement() {
    const start = this.cursor.expectKeyword("if").span.start
    this.cursor.expectPunctuator("(")
    const test = this.expression()
    this.cursor.expectPunctuator(")")
    const consequent = this.statement()
    let alternate = null
    if (this.cursor.matchKeyword("else")) {
      alternate = this.statement()
    }
    return make(NodeKind.IfStatement, { start, end: (alternate ?? consequent).span.end }, { test, consequent, alternate })
  }

  whileStatement() {
    const start = this.cursor.expectKeyword("while").span.start
    this.cursor.expectPunctuator("(")
    const test = this.expression()
    this.cursor.expectPunctuator(")")
    const body = this.statement()
    return make(NodeKind.WhileStatement, { start, end: body.span.end }, { test, body })
  }

  doWhileStatement() {
    const start = this.cursor.expectKeyword("do").span.start
    const body = this.statement()
    this.cursor.expectKeyword("while")
    this.cursor.expectPunctuator("(")
    const test = this.expression()
    this.cursor.expectPunctuator(")")
    this.consumeSemicolon()
    return make(NodeKind.DoWhileStatement, { start, end: this.cursor.previous().span.end }, { test, body })
  }

  forStatement() {
    const start = this.cursor.expectKeyword("for").span.start
    this.cursor.expectPunctuator("(")
    let init = null
    if (!this.cursor.atPunctuator(";")) {
      if (this.cursor.atKeyword("const") || this.cursor.atKeyword("let") || this.cursor.atKeyword("var")) {
        init = this.forVariableDeclaration()
        this.cursor.expectPunctuator(";")
      } else {
        init = this.expression()
        this.cursor.expectPunctuator(";")
      }
    } else {
      this.cursor.expectPunctuator(";")
    }
    let test = null
    if (!this.cursor.atPunctuator(";")) {
      test = this.expression()
    }
    this.cursor.expectPunctuator(";")
    let update = null
    if (!this.cursor.atPunctuator(")")) {
      update = this.expression()
    }
    this.cursor.expectPunctuator(")")
    const body = this.statement()
    return make(NodeKind.ForStatement, { start, end: body.span.end }, { init, test, update, body })
  }

  switchStatement() {
    const start = this.cursor.expectKeyword("switch").span.start
    this.cursor.expectPunctuator("(")
    const discriminant = this.expression()
    this.cursor.expectPunctuator(")")
    this.cursor.expectPunctuator("{")
    const cases = []
    while (!this.cursor.matchPunctuator("}")) {
      const caseStart = this.cursor.current().span.start
      let test = null
      if (this.cursor.matchKeyword("case")) {
        test = this.expression()
      } else {
        this.cursor.expectKeyword("default")
      }
      this.cursor.expectPunctuator(":")
      const consequent = []
      while (!this.cursor.atKeyword("case") && !this.cursor.atKeyword("default") && !this.cursor.atPunctuator("}")) {
        consequent.push(this.statement())
      }
      cases.push(make(NodeKind.SwitchCase, { start: caseStart, end: this.cursor.previous().span.end }, { test, consequent }))
    }
    return make(NodeKind.SwitchStatement, { start, end: this.cursor.previous().span.end }, { discriminant, cases })
  }

  returnStatement() {
    const start = this.cursor.expectKeyword("return").span.start
    let argument = null
    if (!this.cursor.atPunctuator(";") && !this.cursor.atPunctuator("}")) {
      argument = this.expression()
    }
    this.consumeSemicolon()
    return make(NodeKind.ReturnStatement, { start, end: this.cursor.previous().span.end }, { argument })
  }

  breakStatement() {
    const start = this.cursor.expectKeyword("break").span.start
    this.consumeSemicolon()
    return make(NodeKind.BreakStatement, { start, end: this.cursor.previous().span.end }, {})
  }

  continueStatement() {
    const start = this.cursor.expectKeyword("continue").span.start
    this.consumeSemicolon()
    return make(NodeKind.ContinueStatement, { start, end: this.cursor.previous().span.end }, {})
  }

  blockStatement() {
    const start = this.cursor.expectPunctuator("{").span.start
    const body = []
    while (!this.cursor.matchPunctuator("}")) {
      body.push(this.statement())
    }
    return make(NodeKind.BlockStatement, { start, end: this.cursor.previous().span.end }, { body })
  }

  expressionStatement() {
    const expression = this.expression()
    this.consumeSemicolon()
    return make(NodeKind.ExpressionStatement, { start: expression.span.start, end: this.cursor.previous().span.end }, { expression })
  }

  expression() {
    return this.assignment()
  }

  assignment() {
    const left = this.conditional()
    if (ASSIGNMENT_OPERATORS.has(this.cursor.current().value)) {
      const operator = this.cursor.take().value
      const right = this.assignment()
      if (left.kind !== NodeKind.Identifier && left.kind !== NodeKind.MemberExpression) {
        this.diagnostics.error("E1102", "Invalid assignment target", left.span)
      }
      return make(NodeKind.AssignmentExpression, { start: left.span.start, end: right.span.end }, { operator, left, right })
    }
    return left
  }

  conditional() {
    const test = this.binary(0)
    if (!this.cursor.matchOperator("?")) {
      return test
    }
    const consequent = this.assignment()
    this.cursor.expectPunctuator(":")
    const alternate = this.assignment()
    return make(NodeKind.ConditionalExpression, { start: test.span.start, end: alternate.span.end }, { test, consequent, alternate })
  }

  binary(minPrecedence) {
    let left = this.unary()
    for (;;) {
      const token = this.cursor.current()
      if (ASSIGNMENT_OPERATORS.has(token.value)) {
        break
      }
      const precedence = PRECEDENCE[token.value]
      if (precedence === undefined || precedence < minPrecedence) {
        break
      }
      this.cursor.take()
      const right = this.binary(precedence + 1)
      const kind = token.value === "&&" || token.value === "||" || token.value === "??" ? NodeKind.LogicalExpression : NodeKind.BinaryExpression
      left = make(kind, { start: left.span.start, end: right.span.end }, { operator: token.value, left, right })
    }
    return left
  }

  unary() {
    const token = this.cursor.current()
    if (["!", "~", "+", "-", "typeof", "delete"].includes(token.value)) {
      this.cursor.take()
      const argument = this.unary()
      return make(NodeKind.UnaryExpression, { start: token.span.start, end: argument.span.end }, { operator: token.value, argument })
    }
    if (token.value === "++" || token.value === "--") {
      this.cursor.take()
      const argument = this.unary()
      return make(NodeKind.UpdateExpression, { start: token.span.start, end: argument.span.end }, { operator: token.value, argument, prefix: true })
    }
    return this.leftHandSide(false)
  }

  leftHandSide(stopAtCall) {
    let node = this.primary()
    for (;;) {
      if (this.cursor.matchPunctuator(".")) {
        const property = this.cursor.expectIdentifier().value
        node = make(NodeKind.MemberExpression, { start: node.span.start, end: this.cursor.previous().span.end }, { object: node, property, computed: false })
        continue
      }
      if (this.cursor.matchPunctuator("[")) {
        const property = this.expression()
        this.cursor.expectPunctuator("]")
        node = make(NodeKind.MemberExpression, { start: node.span.start, end: this.cursor.previous().span.end }, { object: node, property, computed: true })
        continue
      }
      if (!stopAtCall && this.cursor.matchPunctuator("(")) {
        node = this.finishCall(node)
        continue
      }
      if (this.cursor.current().value === "++" || this.cursor.current().value === "--") {
        const operator = this.cursor.take().value
        node = make(NodeKind.UpdateExpression, { start: node.span.start, end: this.cursor.previous().span.end }, { operator, argument: node, prefix: false })
        continue
      }
      break
    }
    return node
  }

  finishCall(callee) {
    const args = []
    while (!this.cursor.matchPunctuator(")")) {
      args.push(this.assignment())
      if (!this.cursor.matchPunctuator(",")) {
        this.cursor.expectPunctuator(")")
        break
      }
    }
    return make(NodeKind.CallExpression, { start: callee.span.start, end: this.cursor.previous().span.end }, { callee, arguments: args })
  }

  primary() {
    const token = this.cursor.current()
    if (token.kind === "Number") {
      this.cursor.take()
      return make(NodeKind.Literal, token.span, { value: token.value, raw: token.raw })
    }
    if (token.kind === "String") {
      this.cursor.take()
      return make(NodeKind.Literal, token.span, { value: token.value })
    }
    if (token.kind === "Template") {
      this.cursor.take()
      const expressions = token.expressions.map(span => this.reparseExpression(span))
      return make(NodeKind.TemplateLiteral, token.span, { quasis: token.value, expressions })
    }
    if (token.kind === "Keyword") {
      if (token.value === true || token.value === false || token.value === null) {
        this.cursor.take()
        return make(NodeKind.Literal, token.span, { value: token.value })
      }
      if (token.value === "this") {
        this.cursor.take()
        return make(NodeKind.ThisExpression, token.span, {})
      }
      if (token.value === "new") {
        return this.newExpression()
      }
      if (token.value === "function") {
        this.cursor.take()
        let id = null
        if (this.cursor.current().kind === "Identifier") {
          id = this.identifier()
        }
        return this.finishFunction(NodeKind.FunctionExpression, token.span.start, id)
      }
      if (token.value === "typeof" || token.value === "delete") {
        this.cursor.take()
        const argument = this.unary()
        return make(NodeKind.UnaryExpression, { start: token.span.start, end: argument.span.end }, { operator: token.value, argument })
      }
    }
    if (token.kind === "Identifier") {
      this.cursor.take()
      if (this.cursor.matchOperator("=>")) {
        return this.arrowBody(token.span.start, [this.identifierFrom(token)])
      }
      return make(NodeKind.Identifier, token.span, { name: token.value })
    }
    if (this.cursor.matchPunctuator("(")) {
      const start = this.cursor.previous().span.start
      if (this.cursor.matchPunctuator(")")) {
        this.cursor.matchOperator("=>")
        return this.arrowBody(start, [])
      }
      const params = [this.parseBinding()]
      while (this.cursor.matchPunctuator(",")) {
        params.push(this.parseBinding())
      }
      this.cursor.expectPunctuator(")")
      if (this.cursor.matchOperator("=>")) {
        return this.arrowBody(start, params)
      }
      const expression = this.expression()
      this.cursor.expectPunctuator(")")
      return expression
    }
    if (this.cursor.matchPunctuator("[")) {
      return this.arrayExpression()
    }
    if (this.cursor.matchPunctuator("{")) {
      return this.objectExpression()
    }
    this.diagnostics.error("E1100", `Unexpected token ${token.value}`, token.span)
    this.cursor.take()
    return make(NodeKind.Identifier, token.span, { name: "<invalid>" })
  }

  newExpression() {
    const token = this.cursor.expectKeyword("new")
    const callee = this.leftHandSide(true)
    const args = []
    if (this.cursor.matchPunctuator("(")) {
      while (!this.cursor.matchPunctuator(")")) {
        args.push(this.assignment())
        if (!this.cursor.matchPunctuator(",")) {
          this.cursor.expectPunctuator(")")
          break
        }
      }
    }
    return make(NodeKind.NewExpression, { start: token.span.start, end: this.cursor.previous().span.end }, { callee, arguments: args })
  }

  arrayExpression() {
    const start = this.cursor.previous().span.start
    const elements = []
    while (!this.cursor.matchPunctuator("]")) {
      if (this.cursor.matchPunctuator(",")) {
        elements.push(null)
        continue
      }
      elements.push(this.assignment())
      if (!this.cursor.matchPunctuator(",")) {
        this.cursor.expectPunctuator("]")
        break
      }
    }
    return make(NodeKind.ArrayExpression, { start, end: this.cursor.previous().span.end }, { elements })
  }

  objectExpression() {
    const start = this.cursor.previous().span.start
    const properties = []
    while (!this.cursor.matchPunctuator("}")) {
      const keyToken = this.cursor.current()
      const key = keyToken.kind === "Identifier" || keyToken.kind === "String" || keyToken.kind === "Number"
        ? this.cursor.take().value
        : this.cursor.expectIdentifier().value
      let value
      let shorthand = false
      if (this.cursor.matchPunctuator(":")) {
        value = this.assignment()
      } else {
        value = make(NodeKind.Identifier, this.cursor.previous().span, { name: key })
        shorthand = true
      }
      properties.push(make(NodeKind.Property, { start: this.cursor.previous().span.start, end: value.span.end }, { key, value, shorthand }))
      if (!this.cursor.matchPunctuator(",")) {
        this.cursor.expectPunctuator("}")
        break
      }
    }
    return make(NodeKind.ObjectExpression, { start, end: this.cursor.previous().span.end }, { properties })
  }

  arrowBody(start, params) {
    let body
    if (this.cursor.atPunctuator("{")) {
      body = this.blockStatement()
    } else {
      body = this.assignment()
    }
    return make(NodeKind.ArrowFunctionExpression, { start, end: body.span.end }, { params, body })
  }

  reparseExpression(span) {
    const slice = this.source.slice(span.start, span.end)
    return new Parser(slice, this.diagnostics).parseExpression()
  }

  identifier() {
    const token = this.cursor.expectIdentifier()
    return make(NodeKind.Identifier, token.span, { name: token.value })
  }

  identifierFrom(token) {
    return make(NodeKind.Identifier, token.span, { name: token.value })
  }

  consumeSemicolon(strict = false) {
    if (this.cursor.matchPunctuator(";")) {
      return
    }
    if (strict) {
      this.diagnostics.error("E1100", `Expected ;, received ${this.cursor.current().value}`, this.cursor.current().span)
      return
    }
    if (this.cursor.atPunctuator("}") || this.cursor.atKind("Eof")) {
      return
    }
    if (this.cursor.previous() && this.cursor.previous().span.end.line !== this.cursor.current().span.start.line) {
      return
    }
  }
}

export function parse(source, diagnostics = new DiagnosticBag()) {
  return new Parser(source, diagnostics).parse()
}
