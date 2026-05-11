import type { Point, ViewBox } from './map-types'
import { clampNumber } from './geometry'

export function createViewBox(width: number, height: number): ViewBox {
  return { x: 0, y: 0, width, height }
}

export function panViewBox(viewBox: ViewBox, delta: Point, bounds: ViewBox): ViewBox {
  const nextX = clampNumber(viewBox.x - delta.x, bounds.x, bounds.x + bounds.width - viewBox.width)
  const nextY = clampNumber(viewBox.y - delta.y, bounds.y, bounds.y + bounds.height - viewBox.height)
  return { ...viewBox, x: nextX, y: nextY }
}

export function zoomViewBox(viewBox: ViewBox, scale: number, focus: Point, bounds: ViewBox): ViewBox {
  const width = clampNumber(viewBox.width * scale, 240, bounds.width)
  const height = clampNumber(viewBox.height * scale, 160, bounds.height)
  const dx = (focus.x - viewBox.x) / viewBox.width
  const dy = (focus.y - viewBox.y) / viewBox.height
  const x = focus.x - dx * width
  const y = focus.y - dy * height
  const nextX = clampNumber(x, bounds.x, bounds.x + bounds.width - width)
  const nextY = clampNumber(y, bounds.y, bounds.y + bounds.height - height)
  return { x: nextX, y: nextY, width, height }
}
