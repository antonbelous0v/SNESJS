# SNESJS

Statically compiled JavaScript game engine and toolchain for the Super Nintendo Entertainment System. You write games in ordinary JavaScript; the compiler turns them into a real `.sfc` ROM that runs in an emulator and on actual hardware.

## Does it work

Yes. `examples/hello` builds to a ROM and boots in the cycle-accurate [luna](https://github.com/k0b3n4irb/luna) emulator:

```text
INIDISP=$0F   BGMODE=$01
visible sprites: 1
sprite #0: x=112 y=95 tile=$000 pal=0
frames=30 NMIs_served=28
```

## Quick start

Install the backend once — it clones OpenSNES at a pinned commit and builds its 65816 compiler:

```bash
bash scripts/install-sdk.sh
```

A project is two files. `snes.config.js`:

```js
export default {
  name: "My Game",
  entry: "src/main.js",
  scenes: [
    { name: "main", assets: [
      { type: "sprite", name: "player", tiles: 8, colors: 4, sprites: 1 }
    ] }
  ]
}
```

`src/main.js`:

```js
import { Input } from "snes"

let x = 112
let y = 96

function setup() {
  sj_sprite_create(0, 0, 0, x, y)
}

function update() {
  if (Input.down("LEFT") && x > 0) x -= 1
  if (Input.down("RIGHT") && x < 255) x += 1
  if (Input.down("UP") && y > 0) y -= 1
  if (Input.down("DOWN") && y < 255) y += 1
  sj_sprite_set_pos(0, x, y)
}
```

Build it:

```bash
snes build
```

Output: `dist/game.sfc`. `snes doctor` checks the toolchain, `snes analyze` prints resource budgets without compiling.

## setup() and update()

The engine calls two functions by convention. `setup()` runs once at boot, `update()` runs every frame. The game loop is generated for you.

## Input

```js
Input.down("LEFT")        // held
Input.pressed("A")        // went down this frame
Input.released("B")       // went up this frame
Input.axis("horizontal")  // -1 / 0 / +1
Input.axis("vertical")    // -1 / 0 / +1
```

Buttons: `LEFT`, `RIGHT`, `UP`, `DOWN`, `A`, `B`, `X`, `Y`, `L`, `R`, `SELECT`, `START`. These compile to `padHeld` / `padPressed` / `padReleased` register reads.

## Raw API

Low-level `sj_*` functions map directly onto OpenSNES:

```js
sj_sprite_create(id, tile, palette, x, y)
sj_sprite_set_pos(id, x, y)
sj_sprite_set_tile(id, tile)
sj_sprite_hide(id)
sj_wait_vblank()
sj_random()
```

They live in `packages/compiler/runtime/snesjs_runtime.c`.

## Language subset

Objects, arrays, `if` / `for` / `while`, functions, classes, `switch`, template strings, ES modules. No `eval`, `Promise`, `async`/`await`, `try`/`catch`, `Proxy`, dynamic keys, or escaping closures. Classes compile to C structs with functions (`this.hp` → `self->hp`).

## Types

The 65816 has no floating-point hardware, so the compiler infers the smallest integer type:

```js
let lives = 3     // u8
let accel = 0.25  // fixed16
let coins = 1000  // u16
```

Type helpers override inference: `u8(x)`, `i16(x)`, `u16(x)`, `i8(x)`. Statically visible overflow produces a warning.

## snes.config.js

| Field | Meaning |
|---|---|
| `name` | ROM header name, under 21 characters |
| `entry` | Main JS file, defaults to `src/main.js` |
| `scenes` | Scenes with assets, for the budget report |

Assets are declared as `{ type, name, tiles, colors, sprites }`, or with raw `vramBytes` / `cgramColors` / `oamSprites`. `snes analyze` reports them against real hardware limits:

```text
SCENE FOREST
  VRAM              35136 / 65536 bytes
  CGRAM colors         32 / 256
  OAM sprites           8 / 128
```

Over budget → `E4201` with a breakdown.

## Build output

- `dist/game.sfc` — the ROM.
- `dist/game.sym` — symbol table.
- `build/report.html` — budgets, plus `build/report.json`.
- `build/generated/` — the generated C.

## Example games

- `examples/hello` — one sprite, D-pad movement.
- `examples/slime-knight` — knight, slimes, tiled floor, gravity, collision.
- `examples/doodle-jump` — Doodle Jump clone: four platform types, scrolling, score, menu, pause, game over.

```bash
cd examples/doodle-jump
node ../../packages/cli/bin/snes.js build
luna-gui dist/game.sfc
# arrows to move, SELECT to pause, A to start / restart
```

## Pipeline

```text
JavaScript → lexer/parser → types → C11 → OpenSNES (cc65816/QBE/WLA-DX) → 65816 → game.sfc
```

Generated C calls the `sj_*` ABI; OpenSNES is pinned by commit in `snes.lock`.

## Status

Done and proven: the JS→ROM pipeline, type system, resource planner, source-mapped diagnostics, fixed-point math, tile deduplication, palettes, checksummed saves, collision. Not yet done: metasprites, Tiled import, music (SNESMOD), HDMA/Mode7.

## Development

```bash
npm install
npm test
npm run lint
```

Diagnostics point at the source line with a caret and a suggestion.
