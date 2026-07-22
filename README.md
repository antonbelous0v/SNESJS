# SNESJS

A statically compiled JavaScript game engine and toolchain for the Super Nintendo Entertainment System. You write your game in ordinary JavaScript, and the compiler turns it into a real `.sfc` ROM that boots in an emulator or on actual hardware — without you ever having to count a VRAM address or remember when VBlank happens, because the compiler does that boring arithmetic for you.

## Does it actually work?

Yes, and here's the honest proof, not a promise. After building the included `examples/hello` project, I booted the ROM in the cycle-accurate [luna](https://github.com/k0b3n4irb/luna) emulator and got:

```text
INIDISP=$0F (screen on, full brightness)   BGMODE=$01
visible sprites: 1
sprite #0: x=112 y=95 tile=$000 pal=0
frames=30 NMIs_served=28
```

That sprite was defined in JavaScript. The NMI handler firing 28 times across 30 frames means the game loop is actually running. This page will tell you how to write that yourself.

## Quick start

First install the backend once — it clones OpenSNES at a pinned commit and builds its 65816 compiler, which takes a couple of minutes:

```bash
bash scripts/install-sdk.sh
```

Then create a game. Your whole project is two files. First `snes.config.js`:

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

Then build it:

```bash
snes build
```

And out comes `dist/game.sfc` — a real, bootable ROM. `snes doctor` tells you if the toolchain is in place, and `snes analyze` just prints the resource budgets without compiling anything.

## The two functions the engine cares about

The compiler looks for two functions in your code, and their names are a convention, not magic:

- **`setup()`** runs once, at boot, while the screen is off — this is where you create sprites and do one-time setup.
- **`update()`** runs every frame, once per VBlank, after input is polled — this is where your game logic lives.

You don't write a game loop. The compiler generates it for you — poll input, run your `update`, wait for VBlank, push sprites to the screen — so you never have to see the `while (1)` that every SNES game is secretly built on. If you only define `update` and not `setup`, that's fine, it just skips the setup step.

## Input

Input is the one high-level API that's fully wired to the hardware. The buttons are strings, and they map to the real SNES controller:

```js
Input.down("LEFT")        // true while the button is held
Input.pressed("A")        // true only on the frame the button went down
Input.released("B")       // true only on the frame it was released
Input.axis("horizontal")  // -1, 0 or +1 (RIGHT minus LEFT)
Input.axis("vertical")    // -1, 0 or +1 (DOWN minus UP)
```

The button names are `LEFT`, `RIGHT`, `UP`, `DOWN`, `A`, `B`, `X`, `Y`, `L`, `R`, `SELECT`, `START`. `Input.axis("horizontal")` returns `-1` when you hold left, `+1` when you hold right, and `0` otherwise, so `player.x += Input.axis("horizontal") * 2` moves you two pixels per frame in whichever direction you're leaning. These calls compile down to actual `padHeld(0) & KEY_LEFT` register reads, so they cost what the hardware costs and nothing more.

## The raw hardware API

For everything the high-level API doesn't cover yet, there's a thin set of `sj_*` functions that map directly onto OpenSNES. You call them like normal functions; the compiler already knows them:

```js
sj_sprite_create(0, x, y)     // create sprite 0 at (x, y)
sj_sprite_set_pos(0, x, y)    // move sprite 0 to (x, y)
sj_wait_vblank()              // block until the next vertical blank
sj_scene_change("forest")     // switch scenes (adapter stub for now)
sj_audio_play_sfx(0, 1)       // play sound effect 1 from bank 0 (stub)
```

Think of these as the escape hatch — the thing you reach for when you need something the friendly API doesn't wrap yet. They're implemented in `packages/compiler/runtime/snesjs_runtime.c`, which is the single file that translates between SNESJS and OpenSNES, so if you ever need to update the backend you only touch that one file.

## The language you can write

This is JavaScript, but a deliberately small subset of it, because the goal is something that compiles cleanly to a machine with no garbage collector and no runtime. You can use:

```js
const player = { x: 112, y: 96 }      // objects and object literals
let lives = 3                         // let and const
const speeds = [1, 2, 3]              // arrays
if (lives > 0) { ... }                // if/else
for (let i = 0; i < 10; i++) { ... }  // for loops
while (enemy.alive) { ... }           // while and do-while
function add(a, b) { return a + b }   // functions and arrow functions
class Enemy { constructor(x) { this.hp = 3 } update() { this.hp -= 1 } }
switch (state) { case "idle": ... }   // switch
`HP: ${player.hp}`                    // template strings
import { Input } from "snes"          // ES module imports
```

Classes compile to C structs with functions — `class Enemy { update() { this.hp -= 1 } }` becomes a `typedef struct` plus an `Enemy_update(Enemy* self)` function, with `this.hp` turning into `self->hp`. And you can't use the things that don't make sense on a 3.58 MHz machine without an operating system: no `eval`, no `Promise`, no `async`/`await`, no `try`/`catch`, no `Proxy`, no dynamic object keys, no closures that escape and capture state. If you write one, the error tells you *why* in a human sentence instead of dumping a stack trace at you.

## The type system

JavaScript's `number` is a 64-bit float, but the 65816 CPU has no floating-point hardware at all, so treating your numbers as floats would be both slow and wrong. The compiler instead infers the smallest integer type that will hold each value:

```js
let lives = 3     // u8  — fits in an unsigned byte
let x = 120       // u8
let accel = 0.25  // fixed16 — a fixed-point number, no float hardware
let coins = 1000  // u16 — too big for a byte
```

It promotes results when you mix types, so `lives * 2` still works even if the result no longer fits in a `u8`. And it catches overflow it can see at compile time — if you write `let value = 255; value += 10`, you get a `W2101` warning that this `u8` is about to wrap around to 9, instead of discovering it three days later when your health bar suddenly resets. That's the whole point: the hardware limits show up as readable warnings in your terminal, not as silent memory corruption.

## snes.config.js — everything it reads

The config file is plain JavaScript with a default export, and today the compiler reads three things from it:

| Field | Meaning |
|---|---|
| `name` | The game's name. Goes into the ROM header, visible in emulator menus. Keep it under 21 characters. |
| `entry` | Path to your main JavaScript file. If you don't set it, the CLI looks for `src/main.js`. |
| `scenes` | A list of scenes and their assets, used for the resource budget report. |

Each entry in `scenes` looks like:

```js
{ name: "forest", assets: [
  { type: "bg",     name: "forest_tiles", tiles: 970, colors: 16 },
  { type: "sprite", name: "player",       tiles: 128, colors: 16, sprites: 8 }
] }
```

And each asset takes `type` (either `"bg"` or `"sprite"`), a `name`, and then the numbers the compiler needs to budget for it: `tiles` (how many 8×8 tiles it uses, each one is 32 bytes of VRAM), `colors` (how many palette entries), and `sprites` (how many hardware sprites). You can also pass `vramBytes`, `cgramColors` and `oamSprites` directly if you already know the byte counts and would rather be precise. The point of declaring all this is that `snes analyze` can then tell you, before you compile anything:

```text
SCENE FOREST
  VRAM              35136 / 65536 bytes
  CGRAM colors         32 / 256
  OAM sprites           8 / 128
  WRAM                  0 / 131072 bytes
  SPC RAM               0 / 65536 bytes
```

If a scene's assets don't fit in real hardware, you get an `E4201` error listing what's over budget, instead of a ROM that compiles and then silently breaks on actual hardware. That's the difference between this and a toy transpiler.

## What the build produces

`snes build` writes three things into `dist/` and `build/`:

- `dist/game.sfc` — the ROM itself.
- `dist/game.sym` — the symbol table, so emulator debuggers can show your function names.
- `build/report.html` — the resource budgets rendered as an actual HTML page, plus the same data as `build/report.json` for scripting.

The generated C also lands in `build/generated/` if you want to look at it, which is occasionally useful for understanding why something is slow.

## The pipeline, for the curious

```text
your JavaScript
   ↓  lexer + parser          (a recursive-descent parser for the subset above)
   ↓  scope resolution        (lexical scopes, classes, ES modules)
   ↓  type inference          (u8 / i8 / u16 / i16 / u24 / u32 / i32 / fixed8 / fixed16)
   ↓  code generation         (C11 against the SNESJS runtime ABI)
   ↓  resource analysis       (VRAM, CGRAM, OAM, WRAM, SPC RAM budgets)
   ↓
generated C  →  OpenSNES (cc65816 / QBE / WLA-DX)  →  65816  →  game.sfc
```

The reason there's an ABI layer (`sj_*`) between the generated code and OpenSNES is boring but important: it means upgrading OpenSNES doesn't mean rewriting the compiler, and the backend is pinned to an exact commit in `snes.lock` so a build today and a build next month come out byte-identical.

## What's still honest about the state of this

The foundation is real and proven — the full JavaScript-to-ROM pipeline, the type system, the resource planning, the diagnostics that point back at your exact source line, fixed-point math, tile deduplication, palette quantization, save serialization with checksums, collision helpers, and deterministic generated C. What's still thin is the top of the stack: metasprites and animation state machines, Tiled tilemap import, SNESMOD music and BRR sound effects, and the HDMA/Mode 7 effects. Those are layers on top of a working pipeline rather than missing foundations — the right direction to be unfinished in — but I'm not going to pretend they're done.

## Development

If you want to hack on the compiler itself:

```bash
npm install
npm test                # node --test packages/*/test/*.test.js
npm run benchmark       # compiler pipeline, tile dedup, palette quantize
npm run lint            # eslint
```

Every diagnostic carries a source span that points back at your JavaScript, so when the toolchain tells you `velocity.x` can't hold a string, it shows you the exact line, the caret, and a suggestion — instead of the classic `cc65816: error in generated_29.c`, which is the thing that makes people delete the whole project and take up pottery.
