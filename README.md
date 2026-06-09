# SNESJS

A statically compiled JavaScript game engine and toolchain for the Super Nintendo Entertainment System.

SNESJS lets you write SNES games in ordinary JavaScript, then compiles them — through a typed intermediate representation — into C11 that targets the [OpenSNES](https://github.com/k0b3n4irb/opensnes) runtime. The compiler owns the hardware concerns: VRAM layout, CGRAM palettes, OAM budgets, ROM banks, and fixed-point arithmetic.

```js
import { Game, Scene, Sprite, Input } from "snes"

const player = Sprite.create({
  texture: assets.player,
  x: 120,
  y: 100
})

Scene.define("main", {
  update() {
    player.velocity.x = Input.axis("horizontal") * 2
  }
})

Game.start("main")
```

## Pipeline

```text
JavaScript
   ↓  Lexer → Parser            (no runtime JIT, no eval, no GC)
   ↓  Scope resolution          (lexical scopes, classes, ES modules)
   ↓  Type inference            (u8/i8/u16/i16/u24/u32/i32, fixed8/fixed16)
   ↓  Code generation           (C11 against the SNESJS runtime ABI)
   ↓  Resource analysis         (VRAM, CGRAM, OAM, WRAM, SPC RAM budgets)
   ↓
generated C → OpenSNES → 65816 → game.sfc
```

## Architecture

```text
packages/
├── compiler/          @snesjs/compiler
│   ├── src/
│   │   ├── lexer.js          tokenizer with source spans
│   │   ├── parser.js         recursive-descent parser for the JS subset
│   │   ├── analyzer.js       scope + type inference + diagnostics
│   │   ├── types.js          SNES numeric and fixed-point type model
│   │   ├── codegen.js        typed AST → generated C11
│   │   ├── resources.js      hardware budget planning (VRAM/OAM/CGRAM)
│   │   ├── tiles.js          8×8 tile deduplication with flip reuse
│   │   ├── palette.js        RGB555 quantization and shared palettes
│   │   ├── bitmap.js         4bpp bitplane packing
│   │   ├── png.js            PNG decoding for the asset pipeline
│   │   ├── fixed_math.js     fixed-point arithmetic and trig tables
│   │   └── sourcemap.js      generated C → JS source mapping
│   ├── include/              SNESJS runtime ABI header
│   ├── test/                 node:test suites
│   └── benchmarks/           throughput measurements
│
└── cli/                @snesjs/cli  (snes build / analyze / doctor)
```

## Type system

JavaScript `number` does not map to IEEE-754 on the SNES — the 65816 has no hardware floating point. SNESJS infers the smallest safe integer type for every value and promotes binary results, so:

```js
let lives = 3      // u8
let x = 120        // u8, promoted by coordinate use
let accel = 0.25   // fixed16
```

Overflow that is statically visible produces a warning instead of silent wraparound:

```text
W2101: u8 expression may overflow (255 + 10)
```

## Resource planning

Scenes declare their assets and the compiler reports budgets against real SNES hardware limits before any C is emitted:

```text
SCENE FOREST
  VRAM              35136 / 65536 bytes
  CGRAM colors         32 / 256
  OAM sprites           8 / 128
```

Tile deduplication reuses mirrored 8×8 tiles so identical graphics are stored once.

## Commands

```bash
snes build      compile JavaScript to generated C11 + build report
snes analyze    print hardware resource budgets per scene
snes doctor     check the local toolchain
snes test       run host-side tests
```

## Development

```bash
npm install
npm test                # node --test packages/*/test/*.test.js
npm run benchmark       # compiler pipeline, tile dedup, palette quantize
npm run lint            # eslint
```

The compiler is the source of truth. Generated C is deterministic for a given source, and every diagnostic carries a source span that points back to the user's JavaScript.
