export default {
  name: "Hello SNES",
  entry: "src/main.js",
  cartridge: {
    mapping: "auto",
    fastRom: true,
    sram: "0kb"
  },
  video: {
    region: "NTSC",
    defaultMode: 1
  },
  scenes: [
    {
      name: "main",
      assets: [
        { type: "bg", name: "sky_tiles", tiles: 64 },
        { type: "sprite", name: "player", tiles: 128, sprites: 8, colors: 16 }
      ]
    }
  ]
}
