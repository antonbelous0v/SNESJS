export default {
  name: "Hello SNES",
  entry: "src/main.js",
  assets: [
    { file: "assets/hero.png", size: 16 }
  ],
  scenes: [
    {
      name: "main",
      assets: [
        { type: "sprite", name: "hero", tiles: 32, colors: 16, sprites: 1 }
      ]
    }
  ]
}
