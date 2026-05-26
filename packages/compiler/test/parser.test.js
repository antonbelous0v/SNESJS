import test from "node:test"
import assert from "node:assert/strict"

import { parse } from "../src/parser.js"
import { NodeKind } from "../src/ast.js"
import { DiagnosticBag } from "../src/contracts/diagnostics.js"

test("parses imports, declarations and assignments", () => {
  const ast = parse(`import { Sprite, Input } from "snes"
const player = new Sprite({ x: 120, y: 100 })
player.velocity.x = Input.axis("horizontal") * 2`)

  assert.equal(ast.statements[0].kind, NodeKind.ImportDeclaration)
  assert.equal(ast.statements[0].source, "snes")
  assert.equal(ast.statements[0].specifiers.length, 2)

  const declaration = ast.statements[1]
  assert.equal(declaration.kind, NodeKind.VariableDeclaration)
  const init = declaration.declarations[0].init
  assert.equal(init.kind, NodeKind.NewExpression)
  assert.equal(init.callee.name, "Sprite")
  assert.equal(init.arguments.length, 1)
  assert.equal(init.arguments[0].kind, NodeKind.ObjectExpression)

  const assignment = ast.statements[2].expression
  assert.equal(assignment.kind, NodeKind.AssignmentExpression)
  assert.equal(assignment.left.kind, NodeKind.MemberExpression)
  assert.equal(assignment.left.object.object.name, "player")
  assert.equal(assignment.right.kind, NodeKind.BinaryExpression)
  assert.equal(assignment.right.operator, "*")
})

test("parses control flow with compound conditions", () => {
  const ast = parse(`if (Input.pressed("A") && player.onGround) {
  player.velocity.y = -5
} else {
  player.velocity.x = 0
}`)
  const statement = ast.statements[0]
  assert.equal(statement.kind, NodeKind.IfStatement)
  assert.equal(statement.test.kind, NodeKind.LogicalExpression)
  assert.equal(statement.test.operator, "&&")
  assert.equal(statement.consequent.kind, NodeKind.BlockStatement)
  assert.equal(statement.alternate.kind, NodeKind.BlockStatement)
})

test("parses for, while and do-while loops", () => {
  const ast = parse(`for (let i = 0; i < 10; i++) { x += i }
while (enemy.alive) { enemy.update() }
do { tick() } while (running)`)

  assert.equal(ast.statements[0].kind, NodeKind.ForStatement)
  assert.equal(ast.statements[0].init.kind, NodeKind.VariableDeclaration)
  assert.equal(ast.statements[0].update.kind, NodeKind.UpdateExpression)
  assert.equal(ast.statements[1].kind, NodeKind.WhileStatement)
  assert.equal(ast.statements[2].kind, NodeKind.DoWhileStatement)
})

test("parses classes with constructors and methods", () => {
  const ast = parse(`class Enemy {
  constructor(x, y) { this.x = x; this.hp = 3 }
  update() { this.x-- }
}`)
  const declaration = ast.statements[0]
  assert.equal(declaration.kind, NodeKind.ClassDeclaration)
  assert.equal(declaration.id.name, "Enemy")
  assert.equal(declaration.methods.length, 2)
  assert.equal(declaration.methods[0].key, "constructor")
  assert.equal(declaration.methods[1].key, "update")
})

test("parses arrow functions with parameter lists", () => {
  const ast = parse(`const add = (a, b) => a + b
const empty = () => 1
const single = value => value * 2`)
  const add = ast.statements[0].declarations[0].init
  assert.equal(add.kind, NodeKind.ArrowFunctionExpression)
  assert.equal(add.params.length, 2)
  assert.equal(ast.statements[1].declarations[0].init.params.length, 0)
  assert.equal(ast.statements[2].declarations[0].init.params.length, 1)
})

test("parses switch statements", () => {
  const ast = parse(`switch (lives) { case 0: break; default: break }`)
  const statement = ast.statements[0]
  assert.equal(statement.kind, NodeKind.SwitchStatement)
  assert.equal(statement.cases.length, 2)
  assert.equal(statement.cases[0].test.value, 0)
  assert.equal(statement.cases[1].test, null)
})

test("reports invalid assignment targets without throwing", () => {
  const diagnostics = new DiagnosticBag()
  const ast = parse("5 = 10", diagnostics)
  assert.equal(ast.statements.length, 1)
  assert.equal(diagnostics.errors.length, 1)
  assert.equal(diagnostics.errors[0].code, "E1102")
})
