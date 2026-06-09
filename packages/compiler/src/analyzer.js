import { DiagnosticBag } from "./contracts/diagnostics.js"
import { NodeKind } from "./ast.js"
import { Type, TypeKind, BUILTIN_TYPES, narrowestIntegerType, valueRange, promotedNumericType, canOverflow, signedType } from "./types.js"

export class Symbol {
  constructor(name, kind, type, node, mutable = false) {
    this.name = name
    this.kind = kind
    this.type = type
    this.node = node
    this.mutable = mutable
  }
}

export class Scope {
  constructor(parent = null) {
    this.parent = parent
    this.symbols = new Map()
  }

  define(symbol) {
    if (this.symbols.has(symbol.name)) {
      return this.symbols.get(symbol.name)
    }
    this.symbols.set(symbol.name, symbol)
    return symbol
  }

  resolve(name) {
    let scope = this
    while (scope) {
      if (scope.symbols.has(name)) {
        return scope.symbols.get(name)
      }
      scope = scope.parent
    }
    return null
  }

  child() {
    return new Scope(this)
  }
}

const SDK_GLOBALS = Object.freeze([
  "Game", "Scene", "Sprite", "Animation", "Camera", "Input", "Audio", "Save",
  "TileMap", "Background", "Collision", "Timer", "Tween", "Effects", "Mode7",
  "Text", "UI", "Dialogue", "Events", "Random", "Mathx", "Trig", "Pool",
  "EntityPool", "ParticleSystem", "StateMachine", "Cutscene", "AI", "Path",
  "asset", "assets", "paletteGroup", "raw", "native", "unsafe", "assert", "buildTime",
])

export class TypeInferrer {
  constructor(diagnostics = new DiagnosticBag()) {
    this.diagnostics = diagnostics
    this.globalScope = new Scope()
    this.currentScope = this.globalScope
    this.classes = new Map()
    this.registerSdkGlobals()
  }

  registerSdkGlobals() {
    for (const name of SDK_GLOBALS) {
      this.globalScope.define(new Symbol(name, "sdk", Type.unknown(), null, false))
    }
  }

  infer(program) {
    this.collectDeclarations(program)
    for (const statement of program.statements) {
      this.inferStatement(statement)
    }
    return this
  }

  collectDeclarations(program) {
    for (const statement of program.statements) {
      if (statement.kind === NodeKind.FunctionDeclaration && statement.id) {
        this.globalScope.define(new Symbol(statement.id.name, "function", Type.unknown(), statement, true))
      }
      if (statement.kind === NodeKind.ClassDeclaration) {
        const fields = {}
        this.classes.set(statement.id.name, fields)
        this.globalScope.define(new Symbol(statement.id.name, "class", Type.object(fields), statement))
      }
    }
  }

  inferStatement(statement) {
    switch (statement.kind) {
      case NodeKind.VariableDeclaration:
        return this.inferVariableDeclaration(statement)
      case NodeKind.ExpressionStatement:
        this.inferExpression(statement.expression)
        return
      case NodeKind.BlockStatement:
        return this.inferBlock(statement)
      case NodeKind.IfStatement:
        this.inferExpression(statement.test)
        this.inferStatement(statement.consequent)
        if (statement.alternate) {
          this.inferStatement(statement.alternate)
        }
        return
      case NodeKind.WhileStatement:
      case NodeKind.DoWhileStatement:
        this.inferExpression(statement.test)
        this.inferStatement(statement.body)
        return
      case NodeKind.ForStatement:
        return this.inferForStatement(statement)
      case NodeKind.ReturnStatement:
        if (statement.argument) {
          this.inferExpression(statement.argument)
        }
        return
      case NodeKind.FunctionDeclaration:
        return this.inferFunction(statement)
      case NodeKind.ClassDeclaration:
        return this.inferClass(statement)
      case NodeKind.SwitchStatement:
        this.inferExpression(statement.discriminant)
        for (const switchCase of statement.cases) {
          for (const child of switchCase.consequent) {
            this.inferStatement(child)
          }
        }
        return
      case NodeKind.BreakStatement:
      case NodeKind.ContinueStatement:
        return
      default:
        return
    }
  }

  inferBlock(block) {
    const previous = this.currentScope
    this.currentScope = previous.child()
    for (const statement of block.body) {
      this.inferStatement(statement)
    }
    this.currentScope = previous
  }

  inferVariableDeclaration(declaration) {
    for (const declarator of declaration.declarations) {
      const name = this.bindingName(declarator.id)
      const inferredType = declarator.init ? this.inferExpression(declarator.init) : Type.unknown()
      const symbol = this.currentScope.define(new Symbol(name, "variable", inferredType, declarator.id, declaration.keyword !== "const"))
      if (name && declarator.init) {
        if (declarator.init.kind === NodeKind.Literal) {
          symbol.literalValue = declarator.init.value
        }
        this.checkOverflow(symbol, declarator.init)
      }
    }
  }

  inferForStatement(statement) {
    const previous = this.currentScope
    this.currentScope = previous.child()
    if (statement.init) {
      this.inferStatement(statement.init)
    }
    if (statement.test) {
      this.inferExpression(statement.test)
    }
    if (statement.update) {
      this.inferExpression(statement.update)
    }
    this.inferStatement(statement.body)
    this.currentScope = previous
  }

  inferFunction(declaration) {
    const previous = this.currentScope
    this.currentScope = previous.child()
    for (const param of declaration.params) {
      param.type = Type.unknown()
      this.currentScope.define(new Symbol(this.bindingName(param), "parameter", Type.unknown(), param, true))
    }
    this.inferStatement(declaration.body)
    this.currentScope = previous
  }

  inferClass(declaration) {
    const fields = this.classes.get(declaration.id.name) ?? {}
    for (const method of declaration.methods) {
      const previous = this.currentScope
      this.currentScope = previous.child()
      this.currentScope.define(new Symbol("this", "this", Type.object(fields), declaration.id, false))
      for (const param of method.value.params) {
        param.type = Type.unknown()
        this.currentScope.define(new Symbol(this.bindingName(param), "parameter", Type.unknown(), param, true))
      }
      this.inferStatement(method.value.body)
      this.currentScope = previous
    }
  }

  inferExpression(node) {
    if (!node) {
      return Type.unknown()
    }
    switch (node.kind) {
      case NodeKind.Literal: {
        if (typeof node.value === "boolean") {
          node.type = Type.bool()
        } else if (typeof node.value === "number") {
          const range = valueRange(node.value)
          node.type = Number.isInteger(node.value) ? narrowestIntegerType(range.min, range.max) : Type.fixed("fixed16")
        } else if (typeof node.value === "string") {
          node.type = Type.string()
        } else {
          node.type = Type.numeric("u8")
        }
        return node.type
      }
      case NodeKind.Identifier: {
        const symbol = this.currentScope.resolve(node.name)
        if (!symbol) {
          this.diagnostics.error("E1201", `Unknown identifier ${node.name}`, node.span)
          node.type = Type.unknown()
          return node.type
        }
        node.symbol = symbol
        node.type = symbol.type
        return node.type
      }
      case NodeKind.BinaryExpression: {
        const left = this.inferExpression(node.left)
        const right = this.inferExpression(node.right)
        node.type = this.binaryResultType(node.operator, left, right)
        return node.type
      }
      case NodeKind.LogicalExpression: {
        this.inferExpression(node.left)
        this.inferExpression(node.right)
        node.type = Type.bool()
        return node.type
      }
      case NodeKind.UnaryExpression: {
        const argument = this.inferExpression(node.argument)
        if (node.operator === "!" || node.operator === "typeof") {
          node.type = Type.bool()
        } else if (node.operator === "-" && argument.isNumeric()) {
          node.type = signedType(argument)
        } else {
          node.type = argument
        }
        return node.type
      }
      case NodeKind.UpdateExpression: {
        const argument = this.inferExpression(node.argument)
        node.type = argument
        return node.type
      }
      case NodeKind.AssignmentExpression: {
        const left = this.inferExpression(node.left)
        const right = this.inferExpression(node.right)
        node.type = left
        this.checkTypeCompatibility(left, right, node.span)
        this.checkCompoundOverflow(node)
        return node.type
      }
      case NodeKind.ConditionalExpression: {
        this.inferExpression(node.test)
        const consequent = this.inferExpression(node.consequent)
        const alternate = this.inferExpression(node.alternate)
        node.type = promotedNumericType(consequent, alternate)
        return node.type
      }
      case NodeKind.MemberExpression: {
        this.inferExpression(node.object)
        node.type = Type.unknown()
        return node.type
      }
      case NodeKind.CallExpression: {
        this.inferExpression(node.callee)
        for (const argument of node.arguments) {
          this.inferExpression(argument)
        }
        node.type = Type.unknown()
        return node.type
      }
      case NodeKind.NewExpression: {
        this.inferExpression(node.callee)
        for (const argument of node.arguments) {
          this.inferExpression(argument)
        }
        node.type = Type.unknown()
        return node.type
      }
      case NodeKind.ArrayExpression: {
        const elementTypes = node.elements.filter(element => element !== null).map(element => this.inferExpression(element))
        const elementType = elementTypes.length > 0 ? elementTypes[0] : Type.unknown()
        node.type = Type.array(elementType)
        return node.type
      }
      case NodeKind.ObjectExpression: {
        const fields = {}
        for (const property of node.properties) {
          fields[property.key] = this.inferExpression(property.value)
        }
        node.type = Type.object(fields)
        return node.type
      }
      case NodeKind.TemplateLiteral: {
        for (const expression of node.expressions) {
          this.inferExpression(expression)
        }
        node.type = Type.string()
        return node.type
      }
      case NodeKind.ArrowFunctionExpression:
      case NodeKind.FunctionExpression: {
        node.type = Type.unknown()
        return node.type
      }
      case NodeKind.ThisExpression: {
        const symbol = this.currentScope.resolve("this")
        node.type = symbol ? symbol.type : Type.unknown()
        return node.type
      }
      default:
        node.type = Type.unknown()
        return node.type
    }
  }

  binaryResultType(operator, left, right) {
    if (operator === "+" && (left.kind === TypeKind.String || right.kind === TypeKind.String)) {
      return Type.string()
    }
    if ([">", "<", ">=", "<=", "==", "!=", "===", "!=="].includes(operator)) {
      return Type.bool()
    }
    return promotedNumericType(left, right)
  }

  checkCompoundOverflow(node) {
    if (node.operator !== "+=" && node.operator !== "-=") {
      return
    }
    const leftSymbol = node.left.symbol
    if (!leftSymbol || !leftSymbol.type.isNumeric()) {
      return
    }
    if (node.right.kind !== NodeKind.Literal || typeof node.right.value !== "number") {
      return
    }
    if (typeof leftSymbol.literalValue !== "number") {
      return
    }
    const result = node.operator === "+=" ? leftSymbol.literalValue + node.right.value : leftSymbol.literalValue - node.right.value
    if (canOverflow(leftSymbol.type, result)) {
      this.diagnostics.warning("W2101", `u8 expression may overflow (${leftSymbol.literalValue} ${node.operator === "+=" ? "+" : "-"} ${node.right.value})`, node.span)
    }
  }

  checkTypeCompatibility(target, value, span) {
    if (target.kind === TypeKind.Unknown || value.kind === TypeKind.Unknown) {
      return
    }
    if (!target.isNumberLike() && target.kind !== TypeKind.Bool) {
      return
    }
    if (value.kind === TypeKind.String && target.isNumberLike()) {
      this.diagnostics.error("E2013", `Expected a ${target.name} value, but a string was provided`, span)
    }
  }

  checkOverflow(symbol, init) {
    if (!symbol.type.isNumeric()) {
      return
    }
    if (init.kind === NodeKind.AssignmentExpression && init.operator === "+=") {
      const left = init.left
      const right = init.right
      const leftSymbol = left.symbol ?? this.currentScope.resolve(left.name)
      if (leftSymbol && typeof leftSymbol.literalValue === "number" && right.kind === NodeKind.Literal && typeof right.value === "number") {
        const result = leftSymbol.literalValue + right.value
        if (canOverflow(symbol.type, result)) {
          this.diagnostics.warning("W2101", `u8 expression may overflow (${leftSymbol.literalValue} + ${right.value})`, init.span)
        }
      }
      return
    }
    if (init.kind !== NodeKind.BinaryExpression || init.operator !== "+") {
      return
    }
    const left = init.left
    const right = init.right
    if (left.kind === NodeKind.Literal && right.kind === NodeKind.Literal && typeof left.value === "number" && typeof right.value === "number") {
      const result = left.value + right.value
      if (canOverflow(symbol.type, result)) {
        this.diagnostics.warning("W2101", `u8 expression may overflow (${left.value} + ${right.value})`, init.span)
      }
    }
  }

  bindingName(binding) {
    if (!binding) {
      return "<anonymous>"
    }
    if (binding.kind === NodeKind.Identifier) {
      return binding.name
    }
    return "<pattern>"
  }
}
