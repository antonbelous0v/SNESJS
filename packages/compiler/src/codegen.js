import { NodeKind } from "./ast.js"
import { TypeKind } from "./types.js"

const BINARY_OPERATORS = {
  "+": "+",
  "-": "-",
  "*": "*",
  "/": "/",
  "%": "%",
  "==": "==",
  "!=": "!=",
  "<": "<",
  ">": ">",
  "<=": "<=",
  ">=": ">=",
  "&&": "&&",
  "||": "||",
  "<<": "<<",
  ">>": ">>",
  "&": "&",
  "|": "|",
  "^": "^",
}

export class CodeGenerator {
  constructor() {
    this.output = []
    this.indentLevel = 0
    this.classFields = new Map()
    this.functionNames = new Map()
  }

  generate(ast) {
    this.emitRuntimeHeader()
    this.collectClasses(ast)
    this.emitStructDefinitions()
    for (const statement of ast.statements) {
      this.emitStatement(statement)
    }
    this.emitMain(ast)
    return this.output.join("\n")
  }

  emitRuntimeHeader() {
    this.line(`#include "snesjs_runtime.h"`)
    this.line(``)
  }

  collectClasses(ast) {
    for (const statement of ast.statements) {
      if (statement.kind !== NodeKind.ClassDeclaration) {
        continue
      }
      const fields = new Map()
      this.classFields.set(statement.id.name, fields)
      for (const method of statement.methods) {
        this.walkFieldAssignments(method.value.body, fields)
      }
    }
  }

  walkFieldAssignments(node, fields) {
    if (!node || typeof node.kind !== "string") {
      return
    }
    if (node.kind === NodeKind.AssignmentExpression && node.left.kind === NodeKind.MemberExpression && node.left.object.kind === "ThisExpression") {
      const name = node.left.property
      if (!fields.has(name)) {
        fields.set(name, this.fieldType(node.right.type))
      }
    }
    for (const key of Object.keys(node)) {
      if (key === "kind" || key === "span" || key === "type" || key === "symbol") {
        continue
      }
      const value = node[key]
      if (Array.isArray(value)) {
        for (const child of value) {
          this.walkFieldAssignments(child, fields)
        }
      } else if (value && typeof value === "object") {
        this.walkFieldAssignments(value, fields)
      }
    }
  }

  emitStructDefinitions() {
    for (const [name, fields] of this.classFields) {
      this.line(`typedef struct {`)
      this.indent(() => {
        for (const [field, type] of fields) {
          this.line(`${type} ${field};`)
        }
      })
      this.line(`} ${name};`)
      this.line(``)
    }
  }

  emitStatement(statement) {
    switch (statement.kind) {
      case NodeKind.VariableDeclaration:
        this.emitVariableDeclaration(statement)
        return
      case NodeKind.ExpressionStatement:
        this.line(`${this.stripOuterParens(this.emitExpression(statement.expression))};`)
        return
      case NodeKind.IfStatement:
        this.emitIf(statement)
        return
      case NodeKind.WhileStatement:
        this.line(`while (${this.emitExpression(statement.test)}) {`)
        this.indent(() => this.emitStatement(statement.body))
        this.line(`}`)
        return
      case NodeKind.ForStatement:
        this.emitFor(statement)
        return
      case NodeKind.ReturnStatement:
        this.line(statement.argument ? `return ${this.emitExpression(statement.argument)};` : `return;`)
        return
      case NodeKind.BlockStatement:
        this.line(`{`)
        this.indent(() => {
          for (const child of statement.body) {
            this.emitStatement(child)
          }
        })
        this.line(`}`)
        return
      case NodeKind.FunctionDeclaration:
        this.emitFunction(statement)
        return
      case NodeKind.ClassDeclaration:
        this.emitClassMethods(statement)
        return
      case NodeKind.SwitchStatement:
        this.emitSwitch(statement)
        return
      case NodeKind.BreakStatement:
        this.line(`break;`)
        return
      case NodeKind.ContinueStatement:
        this.line(`continue;`)
        return
      default:
        return
    }
  }

  emitVariableDeclaration(statement) {
    for (const declarator of statement.declarations) {
      const name = declarator.id.kind === NodeKind.Identifier ? declarator.id.name : "<pattern>"
      if (declarator.init) {
        this.line(`${this.cType(declarator.init.type)} ${name} = ${this.emitExpression(declarator.init)};`)
      } else {
        this.line(`int ${name};`)
      }
    }
  }

  emitIf(statement) {
    this.line(`if (${this.emitExpression(statement.test)}) {`)
    this.indent(() => this.emitStatement(statement.consequent))
    if (statement.alternate) {
      this.line(`} else {`)
      this.indent(() => this.emitStatement(statement.alternate))
    }
    this.line(`}`)
  }

  emitFor(statement) {
    const init = statement.init ? this.emitForInit(statement.init) : ``
    const test = statement.test ? this.emitExpression(statement.test) : ``
    const update = statement.update ? this.emitExpression(statement.update) : ``
    this.line(`for (${init}; ${test}; ${update}) {`)
    this.indent(() => this.emitStatement(statement.body))
    this.line(`}`)
  }

  emitForInit(init) {
    if (init.kind === NodeKind.VariableDeclaration) {
      const declarator = init.declarations[0]
      const name = declarator.id.name
      const type = declarator.init ? this.cType(declarator.init.type) : "int"
      const value = declarator.init ? this.emitExpression(declarator.init) : "0"
      return `${type} ${name} = ${value}`
    }
    return this.emitExpression(init)
  }

  emitSwitch(statement) {
    this.line(`switch (${this.emitExpression(statement.discriminant)}) {`)
    this.indent(() => {
      for (const switchCase of statement.cases) {
        if (switchCase.test) {
          this.line(`case ${this.emitExpression(switchCase.test)}:`)
        } else {
          this.line(`default:`)
        }
        this.indent(() => {
          for (const child of switchCase.consequent) {
            this.emitStatement(child)
          }
        })
      }
    })
    this.line(`}`)
  }

  emitFunction(declaration) {
    const name = declaration.id.name
    const params = declaration.params.map(param => `${this.parameterType(param)} ${this.bindingName(param)}`).join(", ")
    this.line(`${this.returnType(declaration)} ${name}(${params}) {`)
    this.indent(() => this.emitStatement(declaration.body))
    this.line(`}`)
    this.line(``)
  }

  emitClassMethods(declaration) {
    const className = declaration.id.name
    for (const method of declaration.methods) {
      if (method.key === "constructor") {
        continue
      }
      const params = method.value.params.map(param => `${this.parameterType(param)} ${this.bindingName(param)}`).join(", ")
      this.line(`${this.returnType(method.value)} ${className}_${method.key}(${className}* self${params ? ", " + params : ""}) {`)
      this.indent(() => this.emitStatement(method.value.body))
      this.line(`}`)
      this.line(``)
    }
  }

  emitMain(ast) {
    this.line(`int main(void) {`)
    this.indent(() => {
      this.line(`sj_init();`)
      const hasSetup = ast.statements.some(statement => statement.kind === NodeKind.FunctionDeclaration && statement.id.name === "setup")
      const hasUpdate = ast.statements.some(statement => statement.kind === NodeKind.FunctionDeclaration && statement.id.name === "update")
      if (hasSetup) {
        this.line(`setup();`)
      }
      this.line(`while (1) {`)
      this.indent(() => {
        this.line(`sj_wait_vblank();`)
        this.line(`sj_poll_input();`)
        if (hasUpdate) {
          this.line(`update();`)
        }
        this.line(`sj_flush_dma();`)
        this.line(`sj_oam_upload();`)
      })
      this.line(`}`)
    })
    this.line(`}`)
  }

  emitExpression(node) {
    if (!node) {
      return ""
    }
    switch (node.kind) {
      case NodeKind.Literal:
        return this.emitLiteral(node)
      case NodeKind.Identifier:
        return node.name
      case NodeKind.BinaryExpression:
        return `(${this.emitExpression(node.left)} ${BINARY_OPERATORS[node.operator] ?? node.operator} ${this.emitExpression(node.right)})`
      case NodeKind.LogicalExpression:
        return `(${this.emitExpression(node.left)} ${BINARY_OPERATORS[node.operator] ?? node.operator} ${this.emitExpression(node.right)})`
      case NodeKind.UnaryExpression:
        return `(${node.operator}${this.emitExpression(node.argument)})`
      case NodeKind.UpdateExpression:
        return node.prefix ? `(${node.operator}${this.emitExpression(node.argument)})` : `(${this.emitExpression(node.argument)}${node.operator})`
      case NodeKind.AssignmentExpression:
        return `${this.emitExpression(node.left)} ${node.operator} ${this.emitExpression(node.right)}`
      case NodeKind.MemberExpression:
        return this.emitMember(node)
      case NodeKind.CallExpression:
        return this.emitCall(node)
      case NodeKind.ConditionalExpression:
        return `(${this.emitExpression(node.test)} ? ${this.emitExpression(node.consequent)} : ${this.emitExpression(node.alternate)})`
      case NodeKind.ThisExpression:
        return `self`
      case NodeKind.ArrayExpression:
        return `{ ${node.elements.filter(element => element !== null).map(element => this.emitExpression(element)).join(", ")} }`
      case NodeKind.NewExpression:
        return `{ ${node.arguments.map(argument => this.emitExpression(argument)).join(", ")} }`
      case NodeKind.TemplateLiteral:
        return this.emitTemplate(node)
      case NodeKind.ArrowFunctionExpression:
        return this.emitExpression(node.body)
      default:
        return ""
    }
  }

  emitLiteral(node) {
    if (typeof node.value === "string") {
      return `"${node.value}"`
    }
    if (typeof node.value === "boolean") {
      return node.value ? "1" : "0"
    }
    if (node.value === null) {
      return "0"
    }
    return String(node.value)
  }

  emitMember(node) {
    if (node.object.kind === NodeKind.ThisExpression && !node.computed) {
      return `self->${node.property}`
    }
    if (!node.computed) {
      return `${this.emitExpression(node.object)}.${node.property}`
    }
    return `${this.emitExpression(node.object)}[${this.emitExpression(node.property)}]`
  }

  emitCall(node) {
    const callee = this.emitCallee(node.callee)
    const args = node.arguments.map(argument => this.emitExpression(argument)).join(", ")
    return `${callee}(${args})`
  }

  emitCallee(callee) {
    if (callee.kind === NodeKind.Identifier) {
      return callee.name
    }
    if (callee.kind === NodeKind.MemberExpression) {
      return `${this.emitExpression(callee.object)}_${callee.property}`
    }
    return this.emitExpression(callee)
  }

  emitTemplate(node) {
    const parts = []
    const quasis = node.quasis.split("\u0000")
    for (let index = 0; index < quasis.length; index += 1) {
      if (index > 0 && node.expressions[index - 1]) {
        parts.push(this.emitExpression(node.expressions[index - 1]))
      }
      if (quasis[index]) {
        parts.push(`"${quasis[index]}"`)
      }
    }
    return parts.join(" + ")
  }

  returnType(node) {
    if (node.body.kind === NodeKind.BlockStatement) {
      const returnStatement = node.body.body.find(statement => statement.kind === NodeKind.ReturnStatement && statement.argument)
      return returnStatement ? this.cType(returnStatement.argument.type) : "void"
    }
    return this.cType(node.body.type)
  }

  parameterType(param) {
    return param.type ? this.cType(param.type) : "int"
  }

  bindingName(binding) {
    return binding && binding.kind === NodeKind.Identifier ? binding.name : "arg"
  }

  fieldType(type) {
    if (!type || type.kind === TypeKind.Unknown || type.kind === TypeKind.Object) {
      return "short"
    }
    return this.cType(type)
  }

  cType(type) {
    if (!type) {
      return "int"
    }
    if (type.kind === TypeKind.String) {
      return "const char*"
    }
    if (type.kind === TypeKind.Bool) {
      return "bool"
    }
    if (type.kind === TypeKind.Fixed) {
      return type.bits === 8 ? "signed char" : "short"
    }
    if (type.kind === TypeKind.Void) {
      return "void"
    }
    if (type.kind === TypeKind.Numeric) {
      const mapping = { u8: "unsigned char", i8: "signed char", u16: "unsigned short", i16: "short", u24: "unsigned long", u32: "unsigned long", i32: "long" }
      return mapping[type.name] ?? "int"
    }
    return "int"
  }

  stripOuterParens(text) {
    if (text.startsWith("(") && text.endsWith(")")) {
      return text.slice(1, -1)
    }
    return text
  }

  line(text) {
    this.output.push("  ".repeat(this.indentLevel) + text)
  }

  indent(action) {
    this.indentLevel += 1
    action()
    this.indentLevel -= 1
  }
}

export function generateC(ast) {
  return new CodeGenerator().generate(ast)
}
