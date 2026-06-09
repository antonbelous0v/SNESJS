import { Game, Scene, Sprite, Input } from "snes"

const player = Sprite.create({
  texture: assets.player,
  x: 120,
  y: 100
})

Scene.define("main", {
  update() {
    if (Input.down("LEFT")) player.x -= 1
    if (Input.down("RIGHT")) player.x += 1
    if (Input.down("UP")) player.y -= 1
    if (Input.down("DOWN")) player.y += 1
  }
})

Game.start("main")
