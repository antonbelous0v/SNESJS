# SNESJS

You write a game in ordinary JavaScript, it compiles down to a real `.sfc` that boots in an emulator and on actual hardware. That's the whole project. Everything below is details, and I'll try not to belabor the boring ones.

## Does it work?

Yeah. Built `examples/hello`, ran it in [luna](https://github.com/k0b3n4irb/luna), sprite's there, game loop's spinning, frame isn't black. Not gonna paste the emulator output — if you don't believe me, build it yourself, it's three commands.

## Quick start

Install the backend once (clones OpenSNES at a pinned commit and builds its 65816 compiler, takes a couple minutes):

```bash
bash scripts/install-sdk.sh
```

Then the whole project is two files. `snes.config.js`:

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

And `src/main.js`:

```js
import { Input } from "snes"

let x = 112
let y = 96

function setup() {
  sj_sprite_create(0, x, y)
}

function update() {
  if (Input.down("LEFT") && x > 0) x -= 1
  if (Input.down("RIGHT") && x < 255) x += 1
  if (Input.down("UP") && y > 0) y -= 1
  if (Input.down("DOWN") && y < 255) y += 1
  sj_sprite_set_pos(0, x, y)
}
```

`snes build` → `dist/game.sfc`. Done. `snes doctor` checks the toolchain, `snes analyze` just prints budgets without compiling anything.

## setup() and update()

The engine looks for two functions, names are a convention, not magic. `setup()` runs once at boot while the screen's off, `update()` runs every frame after input is polled. You don't write a game loop — it's generated for you, you'll never see the `while(1)` and the VBlank waits. No `setup`? Fine, it just skips it.

## Input

The one high-level thing that's actually wired to the hardware:

```js
Input.down("LEFT")        // held
Input.pressed("A")        // went down this frame
Input.released("B")       // went up this frame
Input.axis("horizontal")  // -1 / 0 / +1
```

Buttons are strings: `LEFT RIGHT UP DOWN A B X Y L R SELECT START`. Nothing else to explain, `axis` is just right-minus-left, it's obvious. Compiles to `padHeld(0) & KEY_LEFT`, so it costs exactly what it costs on the hardware.

## The raw API

Everything the friendly layer doesn't wrap yet lives in these `sj_*` functions, which the compiler already knows:

```js
sj_sprite_create(0, x, y)
sj_sprite_set_pos(0, x, y)
sj_wait_vblank()
sj_scene_change("forest")
sj_audio_play_sfx(0, 1)
```

Names speak for themselves, not gonna explain each one. They're all in one file, `packages/compiler/runtime/snesjs_runtime.c`, so backend changes only touch that file.

## What language this is

JavaScript, but a trimmed subset, because the SNES has no GC and no runtime. Objects, arrays, `if/for/while`, functions, classes, `switch`, template strings, `import` — all there. No `eval`, `Promise`, `async/await`, `try/catch`, `Proxy`, dynamic keys, escaping closures. Write a forbidden thing and the error explains it like a person instead of dumping a stack trace.

A class compiles to a C struct with functions, `this.hp` becomes `self->hp`. You don't need to care beyond that.

## Types

The 65816 has no floats, so a JS `number` doesn't fit here — the compiler infers the smallest integer type for you:

```js
let lives = 3     // u8
let accel = 0.25  // fixed16
let coins = 1000  // u16
```

Overflow it can see at compile time becomes a warning, not silent memory corruption. That's basically the entire pitch: hardware limits show up as warnings in your terminal, not as a bug three days later.

## snes.config.js

It reads three fields, table:

| Field | Meaning |
|---|---|
| `name` | Game name, goes in the ROM header, keep it under 21 chars |
| `entry` | Path to your main JS, defaults to `src/main.js` |
| `scenes` | Scenes with assets, for the budget report |

An asset is `{ type, name, tiles, colors, sprites }` — or raw `vramBytes` / `cgramColors` / `oamSprites` if you already know the byte counts. The point is `snes analyze` tells you ahead of time whether a scene fits in the hardware:

```text
SCENE FOREST
  VRAM              35136 / 65536 bytes
  CGRAM colors         32 / 256
  OAM sprites           8 / 128
```

Doesn't fit? You get an `E4201` with a breakdown, not a ROM that silently breaks on the console.

## What build produces

`dist/game.sfc` — the ROM. `dist/game.sym` — symbols for debuggers. `build/report.html` — the budgets. Generated C lands in `build/generated/` if you ever want to see why something's slow.

## Example games

Three of them, all build and run:

- `examples/hello` — one sprite, move it with the D-pad. Minimal, but exercises the whole pipeline.
- `examples/slime-knight` — a knight, slimes, grass, gravity and collision.
- `examples/doodle-jump` — a Doodle Jump clone: four platform types, scrolling, score, best score, menu, pause, game over.

```bash
cd examples/doodle-jump
node ../../packages/cli/bin/snes.js build
luna-gui dist/game.sfc
# arrows to move, SELECT to pause, A to start / restart
```

The last two live in `examples/` but aren't committed to git — they're drafts.

## The pipeline

```text
JavaScript → lexer/parser → types → C11 → OpenSNES (cc65816/QBE/WLA-DX) → 65816 → game.sfc
```

The `sj_*` layer between generated C and OpenSNES exists so a backend upgrade doesn't take down the compiler. The backend is pinned by commit in `snes.lock`. Boring but important.

## Honest state of things

The foundation is real: the whole JS→ROM path, types, the resource planner, diagnostics that point at your source line, fixed-point math, tile dedup, palettes, checksummed saves, collision. What's thin is the top of the stack: metasprites, Tiled import, music (SNESMOD), HDMA/Mode7. Those are layers on top of a working pipeline, not a missing foundation. I'm not going to pretend they're done.

## Development

```bash
npm install
npm test
npm run lint
```

Errors show the line, a caret, and a suggestion — not `cc65816: error in generated_29.c`, which is the thing that makes people delete the project and take up pottery.
