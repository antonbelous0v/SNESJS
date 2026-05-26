const NODE_KINDS = [
  "Program",
  "ImportDeclaration",
  "ExportDeclaration",
  "VariableDeclaration",
  "VariableDeclarator",
  "FunctionDeclaration",
  "ClassDeclaration",
  "MethodDefinition",
  "BlockStatement",
  "ExpressionStatement",
  "ReturnStatement",
  "IfStatement",
  "WhileStatement",
  "DoWhileStatement",
  "ForStatement",
  "BreakStatement",
  "ContinueStatement",
  "SwitchStatement",
  "SwitchCase",
  "EmptyStatement",
  "Identifier",
  "Literal",
  "ArrayExpression",
  "ObjectExpression",
  "Property",
  "TemplateLiteral",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "CallExpression",
  "NewExpression",
  "MemberExpression",
  "UnaryExpression",
  "UpdateExpression",
  "BinaryExpression",
  "LogicalExpression",
  "AssignmentExpression",
  "ConditionalExpression",
  "ThisExpression",
]

export const NodeKind = Object.freeze(Object.fromEntries(NODE_KINDS.map(kind => [kind, kind])))

export function make(kind, span, fields) {
  return { kind, span, ...fields }
}

export function isNode(node) {
  return node !== null && typeof node === "object" && typeof node.kind === "string"
}

export function walk(node, visit, parent = null) {
  if (!isNode(node)) {
    return
  }
  visit(node, parent)
  for (const key of Object.keys(node)) {
    if (key === "kind" || key === "span") {
      continue
    }
    const value = node[key]
    if (Array.isArray(value)) {
      for (const child of value) {
        walk(child, visit, node)
      }
    } else if (isNode(value)) {
      walk(value, visit, node)
    }
  }
}
