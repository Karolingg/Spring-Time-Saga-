import type { MapLayout } from './map-types'

const MAP_INDEX_KEY = 'map-editor:index'
const MAP_PREFIX = 'map-editor:map:'

export interface MapIndexEntry {
  id: string
  name: string
  updatedAt: string
}

function getMapKey(mapId: string): string {
  return `${MAP_PREFIX}${mapId}`
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function createMapId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function loadMapIndex(): MapIndexEntry[] {
  if (!canUseStorage()) return []
  const raw = window.localStorage.getItem(MAP_INDEX_KEY)
  if (!raw) return []
  const parsed = JSON.parse(raw) as MapIndexEntry[]
  return Array.isArray(parsed) ? parsed : []
}

export function saveMapIndex(entries: MapIndexEntry[]): void {
  if (!canUseStorage()) return
  window.localStorage.setItem(MAP_INDEX_KEY, JSON.stringify(entries))
}

export function loadMapLayout(mapId: string): MapLayout | null {
  if (!canUseStorage()) return null
  const raw = window.localStorage.getItem(getMapKey(mapId))
  if (!raw) return null
  return JSON.parse(raw) as MapLayout
}

export function deleteMapLayout(mapId: string): void {
  if (!canUseStorage()) return
  const nextIndex = loadMapIndex().filter((entry) => entry.id !== mapId)
  saveMapIndex(nextIndex)
  window.localStorage.removeItem(getMapKey(mapId))
}

export function buildNewMapLayout(layout: Omit<MapLayout, 'id' | 'createdAt' | 'updatedAt'>): MapLayout {
  const now = new Date().toISOString()
  return {
    ...layout,
    id: createMapId(),
    createdAt: now,
    updatedAt: now,
  }
}

export function saveMapLayout(layout: MapLayout): void {
  if (!canUseStorage()) return
  const index = loadMapIndex()
  const nextIndex = upsertIndexEntry(index, layout)
  saveMapIndex(nextIndex)
  window.localStorage.setItem(getMapKey(layout.id), JSON.stringify(layout))
}

function upsertIndexEntry(index: MapIndexEntry[], layout: MapLayout): MapIndexEntry[] {
  const next = index.filter((entry) => entry.id !== layout.id)
  next.unshift({ id: layout.id, name: layout.name, updatedAt: layout.updatedAt })
  return next
}
