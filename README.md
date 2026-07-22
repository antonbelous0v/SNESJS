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
bash scripts/install-sdk.sh   # clone + build OpenSNES (pinned in snes.lock)
snes build      compile JavaScript → generated C11 → real .sfc ROM
snes analyze    print hardware resource budgets per scene
snes doctor     check the local toolchain
snes test       run host-side tests
```

`build` emits `dist/game.sfc`, `dist/game.sym` and `build/report.html`. The
OpenSNES backend is vendored at `vendor/opensnes` and pinned by commit in
`snes.lock`; the generated C links against the SNESJS runtime ABI
(`sj_*`), whose OpenSNES adapter lives in `packages/compiler/runtime/`.

## Development

```bash
npm install
npm test                # node --test packages/*/test/*.test.js
npm run benchmark       # compiler pipeline, tile dedup, palette quantize
npm run lint            # eslint
```

The compiler is the source of truth. Generated C is deterministic for a given source, and every diagnostic carries a source span that points back to the user's JavaScript.
