export type NumericType = "u8" | "i8" | "u16" | "i16" | "u24" | "u32" | "i32"

export type FixedType = "fixed8" | "fixed16"

export interface SpriteOptions {
  texture?: unknown
  x?: number
  y?: number
  priority?: number
  frame?: string
}

export interface SceneConfig {
  assets?: unknown[]
  preload?: () => void
  start?: () => void
  update?: () => void
  lateUpdate?: () => void
  render?: () => void
  stop?: () => void
}

export declare const Game: {
  configure(options: Record<string, unknown>): void
  start(scene: string): void
}

export declare const Scene: {
  define(name: string, config: SceneConfig): void
  change(name: string, options?: Record<string, unknown>): void
  prefetch(name: string): void
}

export declare const Sprite: {
  create(options: SpriteOptions): Record<string, unknown>
}

export declare const Input: {
  down(button: string): boolean
  pressed(button: string): boolean
  released(button: string): boolean
  axis(name: string): number
  map(action: string, button: string): void
}

export declare const assets: Record<string, unknown>
