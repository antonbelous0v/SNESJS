export class Game {
  static configure(options) {
    void options
  }

  static start(scene) {
    void scene
  }
}

export class Scene {
  static define(name, config) {
    void name
    void config
  }

  static change(name, options) {
    void name
    void options
  }

  static prefetch(name) {
    void name
  }
}

export class Input {
  static down(button) {
    void button
    return false
  }

  static pressed(button) {
    void button
    return false
  }

  static released(button) {
    void button
    return false
  }

  static axis(name) {
    void name
    return 0
  }

  static map(action, button) {
    void action
    void button
  }
}

export class Sprite {
  static create(options) {
    return options ?? {}
  }
}

export class Audio {
  static music = { play: asset => void asset, stop: () => {} }
  static sfx = { play: (asset, options) => void options }
}

export const assets = new Proxy({}, {
  get: () => ({}),
})
