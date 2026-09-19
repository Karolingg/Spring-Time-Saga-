export interface WallSegment {
  cx: number
  cy: number
  length: number
  thickness: number
  angle: number
  /** Drawn with a lighter line weight than the plan's structural walls — stair
   *  treads, fixtures and similar detail, which should not stand at full height. */
  detail: boolean
}

type Matrix = [number, number, number, number, number, number]

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]
const DARK_MAX_LUM = 0.35
const ROOM_MAX_LUM = 0.97
const MIN_STROKE_WIDTH = 1.2
const FILL_MIN_LONG = 28
const FILL_MAX_SHORT = 16
// Below this much stroke-derived wall, the plan almost certainly draws rooms as
// filled polygons instead of wall strokes, so their outlines stand in for walls.
const STROKE_WALL_MIN_TOTAL = 3000
const PLAN_W = 1200
const PLAN_H = 675

const cache = new Map<string, Promise<WallSegment[]>>()

function luminance(value: string | null | undefined): number | null {
  if (!value) return null
  let color = value.trim().toLowerCase()
  if (color === 'none') return null
  if (color === 'black') return 0
  if (color === 'white') return 1
  if (!color.startsWith('#')) return null
  if (color.length === 4) color = `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
  if (color.length !== 7) return null
  const r = parseInt(color.slice(1, 3), 16) / 255
  const g = parseInt(color.slice(3, 5), 16) / 255
  const b = parseInt(color.slice(5, 7), 16) / 255
  if (Number.isNaN(r + g + b)) return null
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ]
}

function parseTransform(value: string | null): Matrix {
  if (!value) return IDENTITY
  let result: Matrix = IDENTITY
  const pattern = /(\w+)\s*\(([^)]*)\)/g
  let match = pattern.exec(value)
  while (match) {
    const args = match[2].split(/[,\s]+/).filter(Boolean).map(Number)
    const name = match[1]
    if (name === 'matrix' && args.length === 6) {
      result = multiply(result, args as Matrix)
    } else if (name === 'translate') {
      result = multiply(result, [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0])
    } else if (name === 'scale') {
      result = multiply(result, [args[0] ?? 1, 0, 0, args[1] ?? args[0] ?? 1, 0, 0])
    } else if (name === 'rotate') {
      const a = ((args[0] ?? 0) * Math.PI) / 180
      const rotation: Matrix = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]
      result = args.length === 3
        ? multiply(result, multiply([1, 0, 0, 1, args[1], args[2]], multiply(rotation, [1, 0, 0, 1, -args[1], -args[2]])))
        : multiply(result, rotation)
    }
    match = pattern.exec(value)
  }
  return result
}

function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

function matrixScale(m: Matrix): number {
  return (Math.hypot(m[0], m[1]) + Math.hypot(m[2], m[3])) / 2
}

function parsePathData(d: string): Array<Array<[number, number]>> {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g)
  if (!tokens) return []
  const subpaths: Array<Array<[number, number]>> = []
  let current: Array<[number, number]> = []
  let cx = 0
  let cy = 0
  let startX = 0
  let startY = 0
  let command = ''
  let i = 0

  const take = (n: number) => {
    const values = tokens.slice(i, i + n).map(Number)
    i += n
    return values
  }

  while (i < tokens.length) {
    const token = tokens[i]
    if (/[A-Za-z]/.test(token)) {
      command = token
      i += 1
      if (command === 'Z' || command === 'z') {
        if (current.length) {
          current.push([startX, startY])
          subpaths.push(current)
          current = []
        }
        cx = startX
        cy = startY
      }
      continue
    }
    if (!command) {
      i += 1
      continue
    }
    const relative = command === command.toLowerCase()
    switch (command.toUpperCase()) {
      case 'M': {
        const [x, y] = take(2)
        cx = relative ? cx + x : x
        cy = relative ? cy + y : y
        if (current.length) subpaths.push(current)
        current = [[cx, cy]]
        startX = cx
        startY = cy
        command = relative ? 'l' : 'L'
        break
      }
      case 'L': {
        const [x, y] = take(2)
        cx = relative ? cx + x : x
        cy = relative ? cy + y : y
        current.push([cx, cy])
        break
      }
      case 'H': {
        const [x] = take(1)
        cx = relative ? cx + x : x
        current.push([cx, cy])
        break
      }
      case 'V': {
        const [y] = take(1)
        cy = relative ? cy + y : y
        current.push([cx, cy])
        break
      }
      case 'C': {
        const v = take(6)
        cx = relative ? cx + v[4] : v[4]
        cy = relative ? cy + v[5] : v[5]
        current.push([cx, cy])
        break
      }
      case 'S':
      case 'Q': {
        const v = take(4)
        cx = relative ? cx + v[2] : v[2]
        cy = relative ? cy + v[3] : v[3]
        current.push([cx, cy])
        break
      }
      case 'T': {
        const [x, y] = take(2)
        cx = relative ? cx + x : x
        cy = relative ? cy + y : y
        current.push([cx, cy])
        break
      }
      case 'A': {
        const v = take(7)
        cx = relative ? cx + v[5] : v[5]
        cy = relative ? cy + v[6] : v[6]
        current.push([cx, cy])
        break
      }
      default:
        i += 1
    }
  }
  if (current.length) subpaths.push(current)
  return subpaths.filter((sub) => sub.length >= 2)
}

function segmentBetween(a: [number, number], b: [number, number], thickness: number): WallSegment | null {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const length = Math.hypot(dx, dy)
  if (length < 1) return null
  return {
    cx: (a[0] + b[0]) / 2,
    cy: (a[1] + b[1]) / 2,
    length,
    thickness: Math.max(thickness, 2),
    angle: Math.atan2(dy, dx),
    detail: false,
  }
}

function markDetailSegments(segments: WallSegment[]): WallSegment[] {
  const lengthByWeight = new Map<number, number>()
  for (const segment of segments) {
    const key = Math.round(segment.thickness * 4) / 4
    lengthByWeight.set(key, (lengthByWeight.get(key) ?? 0) + segment.length)
  }
  let dominant = 0
  let best = -1
  for (const [weight, total] of lengthByWeight) {
    if (total > best) {
      best = total
      dominant = weight
    }
  }
  for (const segment of segments) {
    segment.detail = Math.abs(segment.thickness - dominant) > 0.15 * dominant
  }
  return segments
}

function numeric(value: string | null): number | null {
  if (value === null) return null
  if (value.trim().endsWith('%')) return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function extractFromDocument(doc: Document): WallSegment[] {
  const strokeWalls: WallSegment[] = []
  const regions: Array<Array<[number, number]>> = []

  const visit = (node: Element, ctm: Matrix, style: Record<string, string>, inDefs: boolean) => {
    const tag = node.tagName.toLowerCase()
    const hidden = inDefs || tag === 'defs' || tag === 'clippath'
    const nextCtm = multiply(ctm, parseTransform(node.getAttribute('transform')))
    const nextStyle = { ...style }
    for (const key of ['fill', 'stroke', 'stroke-width']) {
      const value = node.getAttribute(key)
      if (value !== null) nextStyle[key] = value
    }

    if (!hidden) {
      let subpaths: Array<Array<[number, number]>> | null = null
      if (tag === 'path') {
        const d = node.getAttribute('d')
        if (d) subpaths = parsePathData(d)
      } else if (tag === 'rect') {
        const x = numeric(node.getAttribute('x') ?? '0')
        const y = numeric(node.getAttribute('y') ?? '0')
        const w = numeric(node.getAttribute('width'))
        const h = numeric(node.getAttribute('height'))
        if (x !== null && y !== null && w !== null && h !== null) {
          subpaths = [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]]
        }
      }

      if (subpaths?.length) {
        const fillLum = luminance(nextStyle.fill)
        const strokeLum = luminance(nextStyle.stroke)
        const scale = matrixScale(nextCtm)
        const strokeWidth = (Number.parseFloat(nextStyle['stroke-width'] ?? '1') || 1) * scale

        if (strokeLum !== null && strokeLum <= DARK_MAX_LUM && strokeWidth >= MIN_STROKE_WIDTH) {
          for (const sub of subpaths) {
            const points = sub.map(([x, y]) => apply(nextCtm, x, y))
            for (let k = 0; k < points.length - 1; k += 1) {
              const segment = segmentBetween(points[k], points[k + 1], strokeWidth)
              if (segment) strokeWalls.push(segment)
            }
          }
        } else if (fillLum !== null && fillLum > DARK_MAX_LUM && fillLum < ROOM_MAX_LUM) {
          for (const sub of subpaths) {
            const points = sub.map(([x, y]) => apply(nextCtm, x, y))
            const xs = points.map((p) => p[0])
            const ys = points.map((p) => p[1])
            const width = Math.max(...xs) - Math.min(...xs)
            const height = Math.max(...ys) - Math.min(...ys)
            if (width * height <= 0.85 * PLAN_W * PLAN_H) regions.push(points)
          }
        } else if (fillLum !== null && fillLum <= DARK_MAX_LUM) {
          for (const sub of subpaths) {
            const points = sub.map(([x, y]) => apply(nextCtm, x, y))
            const xs = points.map((p) => p[0])
            const ys = points.map((p) => p[1])
            const width = Math.max(...xs) - Math.min(...xs)
            const height = Math.max(...ys) - Math.min(...ys)
            const long = Math.max(width, height)
            const short = Math.min(width, height)
            // Long, thin dark fills are walls drawn as filled slabs; anything
            // chunkier at this darkness is lettering or an icon.
            if (long >= FILL_MIN_LONG && short <= FILL_MAX_SHORT) {
              strokeWalls.push({
                cx: (Math.min(...xs) + Math.max(...xs)) / 2,
                cy: (Math.min(...ys) + Math.max(...ys)) / 2,
                length: long,
                thickness: Math.max(short, 2),
                angle: width >= height ? 0 : Math.PI / 2,
                detail: false,
              })
            }
          }
        }
      }
    }

    for (const child of Array.from(node.children)) {
      visit(child, nextCtm, nextStyle, hidden)
    }
  }

  visit(doc.documentElement, IDENTITY, {}, false)

  const strokeTotal = strokeWalls.reduce((sum, wall) => sum + wall.length, 0)
  if (strokeTotal >= STROKE_WALL_MIN_TOTAL) return markDetailSegments(strokeWalls)

  const outlineWalls = [...strokeWalls]
  for (const points of regions) {
    for (let k = 0; k < points.length - 1; k += 1) {
      const segment = segmentBetween(points[k], points[k + 1], 3)
      if (segment) outlineWalls.push(segment)
    }
  }
  return markDetailSegments(outlineWalls)
}

export function loadFloorplanWalls(src: string): Promise<WallSegment[]> {
  const cached = cache.get(src)
  if (cached) return cached

  const request = fetch(src)
    .then((response) => (response.ok ? response.text() : Promise.reject(new Error(String(response.status)))))
    .then((text) => extractFromDocument(new DOMParser().parseFromString(text, 'image/svg+xml')))
    .catch(() => [] as WallSegment[])

  cache.set(src, request)
  return request
}
