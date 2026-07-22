# SNESJS

A statically compiled JavaScript game engine and toolchain for the Super Nintendo Entertainment System — the whole idea being that you write your game in ordinary JavaScript, and a compiler turns it into a real `.sfc` ROM that you can boot in an emulator or on actual hardware, without you ever having to think about VRAM addresses or DMA timing or any of the other things that make writing SNES games feel like you're fighting the machine instead of making a game.

## Why this exists, honestly

Here's the thing about the SNES, and I'm going to spell it out because it's the reason this whole project exists. The console has a 65C816 CPU running at about 3.58 MHz, it has 128 kilobytes of work RAM, 64 kilobytes of video RAM, and a palette of 256 colors, and absolutely none of it has any concept of floating-point numbers. Writing a game for it normally means writing C, or worse, assembly, and then manually doing a pile of bookkeeping that has nothing to do with the fun part of your game — figuring out which graphics live at which VRAM address, making sure you only touch VRAM during the vertical blanking interval or the write silently fails, packing colors down to 15 bits, counting how many sprites you're allowed to draw on a single scanline. People are too lazy to do all of that by hand, and they shouldn't have to, because a compiler is perfectly capable of doing that boring arithmetic for you while you think about whether your jump feels good.

So the pitch is: you write something that looks basically like normal JavaScript, with sprites and input and a game loop, and SNESJS quietly figures out all the hardware stuff behind your back. It infers the smallest integer type that will hold your `let lives = 3`, it warns you when your `u8` counter is about to overflow, it plans where your tiles go in VRAM so you never type a hex address, and then it generates C, hands that C to OpenSNES, and out the other end comes a bootable ROM. You still bump into the hardware eventually — the SNES is a small machine and it will always be a small machine — but you bump into it as a readable warning in your terminal, not as silent memory corruption at 3 in the morning.

## The part that actually matters: this produces a real ROM

This is not a transpiler toy that stops at "look, I turned `x += 1` into `x += 1` and called it a day." The full chain is wired up and it boots. I verified it by hand, and here's the honest evidence, captured from the cycle-accurate [luna](https://github.com/k0b3n4irb/luna) emulator after building the included `examples/hello` project:

```text
INIDISP=$0F (screen on, full brightness)   BGMODE=$01
visible sprites: 1
sprite #0: x=112 y=95 tile=$000 pal=0
frames=30 NMIs_served=28
```

That sprite came from JavaScript. The NMI handler firing 28 times in 30 frames means the game loop is actually spinning, not just sitting there. The screenshot isn't blank — there are real rendered pixels where the sprite should be. So the hard part, the part every SNES-in-JavaScript project quietly hand-waves, is done and demonstrated, not promised.

## How the pipeline works, in excruciating detail

Because people are too lazy to read separate docs, here's the whole flow in one place:

```text
your JavaScript
   ↓  lexer + parser          (a recursive-descent parser for a JS subset)
   ↓  scope resolution        (lexical scopes, classes, ES modules)
   ↓  type inference          (u8 / i8 / u16 / i16 / u24 / u32 / i32 / fixed8 / fixed16)
   ↓  code generation         (C11 against the SNESJS runtime ABI)
   ↓  resource analysis       (VRAM, CGRAM, OAM, WRAM, SPC RAM budgets)
   ↓
generated C  →  OpenSNES (cc65816 / QBE / WLA-DX)  →  65816  →  game.sfc
```

The type inference is the part that makes this actually appropriate for the hardware. JavaScript's `number` is an IEEE-754 double, but the 65816 has no floating point at all, so treating your numbers as doubles would be both wasteful and wrong. Instead the compiler looks at every literal and every operation and picks the smallest safe integer type that fits — `let lives = 3` becomes a `u8`, `let accel = 0.25` becomes a `fixed16` — and it promotes results when you mix them, the way a careful C programmer would, except you never had to be careful. It even flags overflow that it can see at compile time, so `let value = 255; value += 10` produces a `W2101` warning instead of silently wrapping around to 9, which is the kind of bug that would otherwise ruin a Sunday.

The resource analysis is the other half of the same idea. Every scene declares its assets, and before any C is generated the compiler checks them against the actual hardware limits and prints a budget you can actually read:

```text
SCENE FOREST
  VRAM              35136 / 65536 bytes
  CGRAM colors         32 / 256
  OAM sprites           8 / 128
```

And the asset pipeline deduplicates your 8×8 tiles, reusing mirrored copies so you don't store the same graphic five times just because an artist flipped it, which matters a lot when you only have 64 kilobytes of video RAM to begin with.

## The OpenSNES bit

The compiler doesn't try to talk to the hardware itself, because reinventing a PPU driver in 2026 is a great way to spend a year and produce nothing playable. It targets [OpenSNES](https://github.com/k0b3n4irb/opensnes), which already has the C11 compiler for the 65816, the sprite and background APIs, the DMA helpers, and all the rest of the boring-but-necessary infrastructure. SNESJS sits on top of it through a thin adapter layer — the generated C calls functions named `sj_init`, `sj_sprite_create`, `sj_wait_vblank` and so on, and a small C file (`packages/compiler/runtime/snesjs_runtime.c`) implements those in terms of OpenSNES. The point of that indirection is that upgrading OpenSNES shouldn't mean rewriting your compiler, and it's pinned to an exact commit in `snes.lock` so a build today and a build next month produce the same ROM.

## Getting it running

First install the backend — this clones OpenSNES at the pinned commit and builds its compiler and library, which takes a couple of minutes and you only do it once:

```bash
bash scripts/install-sdk.sh
```

Then the commands are:

```bash
snes build      compile JavaScript → generated C11 → real .sfc ROM
snes analyze    print hardware resource budgets per scene
snes doctor     check that the local toolchain is actually there
snes test       run the host-side test suite
```

`build` writes `dist/game.sfc`, `dist/game.sym`, and a `build/report.html` with the budgets rendered as an actual HTML page, because plain text reports are for people who enjoy squinting. The SDK itself lands in `vendor/opensnes` and is gitignored — it's 78 megabytes of compiled toolchain and there's no reason to commit that to a repo when a one-line script reproduces it deterministically.

## What's honest about the state of this

I should be upfront about what's here and what isn't, because nothing is more annoying than a README that promises a finished engine and then you find out the audio is a stub. The core is real and proven: the full JavaScript-to-ROM pipeline, the type system, the resource planning, the diagnostics that point back at your source line, the fixed-point math, the tile and palette handling, the save serialization with checksums, the collision helpers, the containers, and the deterministic generated C. What's still thin is the top of the stack — metasprites and animation state machines, Tiled tilemap import, SNESMOD music and BRR sound effects, and the fancy HDMA/Mode 7 effects. Those are layers on top of a working pipeline rather than missing foundations, which is the direction you want to be unfinished in, but I'm not going to pretend they're done.

## Development

If you want to hack on the compiler itself:

```bash
npm install
npm test                # node --test packages/*/test/*.test.js
npm run benchmark       # compiler pipeline, tile dedup, palette quantize
npm run lint            # eslint
```

The compiler is the source of truth, and every diagnostic carries a source span that points back at your JavaScript, so when the toolchain tells you that `velocity.x` can't hold a string, it shows you the exact line and the caret and a suggestion, instead of the classic and completely useless `cc65816: error in generated_29.c` that makes people want to delete the whole project and take up pottery.
