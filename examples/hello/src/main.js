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
