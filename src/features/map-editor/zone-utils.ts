import type { Point, Rect, Zone, ZoneType } from './map-types'
import { getPolygonBounds, movePoints, moveRect, pointInPolygon, rectToPoints } from './geometry'

const ZONE_LABELS: Record<ZoneType, string> = {
  spawn: 'Spawn',
  walkable: 'Hallway',
  exit: 'Exit',
}

export function buildZoneName(type: ZoneType, zones: Zone[]): string {
  const base = ZONE_LABELS[type]
  const count = zones.filter((zone) => zone.type === type).length + 1
  return `${base} ${count}`
}

export function buildRectZone(type: ZoneType, rect: Rect, zones: Zone[]): Zone {
  const spawnDefaults = type === 'spawn' ? { maxAgents: 60, spawnCount: 40 } : {}
  return {
    id: createZoneId(),
    name: buildZoneName(type, zones),
    type,
    shape: 'rect',
    rect,
    ...spawnDefaults,
  }
}

export function buildPolygonZone(type: ZoneType, points: Point[], zones: Zone[]): Zone {
  const spawnDefaults = type === 'spawn' ? { maxAgents: 60, spawnCount: 40 } : {}
  return {
    id: createZoneId(),
    name: buildZoneName(type, zones),
    type,
    shape: 'polygon',
    points,
    ...spawnDefaults,
  }
}

export function getZonePoints(zone: Zone): Point[] {
  return zone.shape === 'rect' ? rectToPoints(zone.rect) : zone.points
}

export function getZoneBounds(zone: Zone): Rect {
  return getPolygonBounds(getZonePoints(zone))
}

export function moveZone(zone: Zone, delta: Point): Zone {
  if (zone.shape === 'rect') {
    return { ...zone, rect: moveRect(zone.rect, delta) }
  }
  return { ...zone, points: movePoints(zone.points, delta) }
}

export function moveZoneVertex(zone: Zone, index: number, point: Point): Zone {
  if (zone.shape === 'rect') {
    const points = rectToPoints(zone.rect)
    const next = points.map((p, idx) => (idx === index ? point : p))
    const rect = getPolygonBounds(next)
    return { ...zone, rect }
  }
  const nextPoints = zone.points.map((p, idx) => (idx === index ? point : p))
  return { ...zone, points: nextPoints }
}

export function isPointInZone(point: Point, zone: Zone): boolean {
  return pointInPolygon(point, getZonePoints(zone))
}

function createZoneId(): string {
  return `zone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}
