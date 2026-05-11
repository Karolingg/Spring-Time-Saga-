import { useCallback, useMemo, useState } from 'react'
import type { EditorTool, MapImage, MapLayout, Point, Rect, Zone, ZoneType } from './map-types'
import { buildPolygonZone, buildRectZone, isPointInZone, moveZone, moveZoneVertex } from './zone-utils'
import { createViewBox, panViewBox, zoomViewBox } from './view-box'
import { rectFromPoints } from './geometry'

interface DraftRect {
  start: Point
  end: Point
}

export function useMapEditor(initialMap: MapLayout) {
  const [mapLayout, setMapLayout] = useState<MapLayout>(initialMap)
  const [tool, setTool] = useState<EditorTool>('select')
  const [zoneType, setZoneType] = useState<ZoneType>('walkable')
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [draftRect, setDraftRect] = useState<DraftRect | null>(null)
  const [draftPolygon, setDraftPolygon] = useState<Point[]>([])
  const [viewBox, setViewBox] = useState(() => createViewBox(initialMap.image.width, initialMap.image.height))

  const replaceMapLayout = useCallback((next: MapLayout) => {
    setMapLayout(next)
    setViewBox(createViewBox(next.image.width, next.image.height))
    setSelectedZoneId(null)
    setDraftRect(null)
    setDraftPolygon([])
  }, [])

  const updateMap = useCallback((updater: (current: MapLayout) => MapLayout) => {
    setMapLayout((current) => updater(current))
  }, [])

  const setImage = useCallback((image: MapImage) => {
    updateMap((current) => ({ ...current, image, updatedAt: new Date().toISOString() }))
    setViewBox(createViewBox(image.width, image.height))
  }, [updateMap])

  const updateZones = useCallback((zones: Zone[]) => {
    updateMap((current) => ({ ...current, zones, updatedAt: new Date().toISOString() }))
  }, [updateMap])

  const addRectZone = useCallback((rect: Rect) => {
    updateZones([...mapLayout.zones, buildRectZone(zoneType, rect, mapLayout.zones)])
  }, [mapLayout.zones, updateZones, zoneType])

  const addPolygonZone = useCallback((points: Point[]) => {
    updateZones([...mapLayout.zones, buildPolygonZone(zoneType, points, mapLayout.zones)])
  }, [mapLayout.zones, updateZones, zoneType])

  const deleteZone = useCallback((zoneId: string) => {
    updateZones(mapLayout.zones.filter((zone) => zone.id !== zoneId))
    if (selectedZoneId === zoneId) setSelectedZoneId(null)
  }, [mapLayout.zones, selectedZoneId, updateZones])

  const renameZone = useCallback((zoneId: string, name: string) => {
    updateZones(mapLayout.zones.map((zone) => zone.id === zoneId ? { ...zone, name } : zone))
  }, [mapLayout.zones, updateZones])

  const updateZone = useCallback((nextZone: Zone) => {
    updateZones(mapLayout.zones.map((zone) => zone.id === nextZone.id ? nextZone : zone))
  }, [mapLayout.zones, updateZones])

  const moveSelectedZone = useCallback((delta: Point) => {
    if (!selectedZoneId) return
    const zone = mapLayout.zones.find((item) => item.id === selectedZoneId)
    if (!zone) return
    updateZone(moveZone(zone, delta))
  }, [mapLayout.zones, selectedZoneId, updateZone])

  const moveSelectedVertex = useCallback((index: number, point: Point) => {
    if (!selectedZoneId) return
    const zone = mapLayout.zones.find((item) => item.id === selectedZoneId)
    if (!zone) return
    updateZone(moveZoneVertex(zone, index, point))
  }, [mapLayout.zones, selectedZoneId, updateZone])

  const selectZoneByPoint = useCallback((point: Point) => {
    const zone = [...mapLayout.zones].reverse().find((item) => isPointInZone(point, item))
    setSelectedZoneId(zone ? zone.id : null)
  }, [mapLayout.zones])

  const setMapName = useCallback((name: string) => {
    updateMap((current) => ({ ...current, name, updatedAt: new Date().toISOString() }))
  }, [updateMap])

  const updateViewBox = useCallback((delta: Point, bounds: Point) => {
    setViewBox((current) => panViewBox(current, delta, { x: 0, y: 0, width: bounds.x, height: bounds.y }))
  }, [])

  const zoomToPoint = useCallback((scale: number, focus: Point, bounds: Point) => {
    setViewBox((current) => zoomViewBox(current, scale, focus, { x: 0, y: 0, width: bounds.x, height: bounds.y }))
  }, [])

  const setDraftFromPoints = useCallback((start: Point, end: Point) => {
    setDraftRect({ start, end })
  }, [])

  const commitDraftRect = useCallback(() => {
    if (!draftRect) return
    const rect = rectFromPoints(draftRect.start, draftRect.end)
    if (rect.width > 2 && rect.height > 2) addRectZone(rect)
    setDraftRect(null)
  }, [draftRect, addRectZone])

  const addDraftPoint = useCallback((point: Point) => {
    setDraftPolygon((current) => [...current, point])
  }, [])

  const commitDraftPolygon = useCallback(() => {
    if (draftPolygon.length < 3) return
    addPolygonZone(draftPolygon)
    setDraftPolygon([])
  }, [draftPolygon, addPolygonZone])

  const cancelDraft = useCallback(() => {
    setDraftRect(null)
    setDraftPolygon([])
  }, [])

  const draftPreview = useMemo(() => {
    if (!draftRect) return null
    return rectFromPoints(draftRect.start, draftRect.end)
  }, [draftRect])

  return {
    mapLayout,
    tool,
    zoneType,
    selectedZoneId,
    viewBox,
    draftRect,
    draftPolygon,
    draftPreview,
    setTool,
    setZoneType,
    setSelectedZoneId,
    setMapName,
    replaceMapLayout,
    setImage,
    addRectZone,
    addPolygonZone,
    deleteZone,
    renameZone,
    updateZone,
    moveSelectedZone,
    moveSelectedVertex,
    selectZoneByPoint,
    updateViewBox,
    zoomToPoint,
    setDraftFromPoints,
    commitDraftRect,
    addDraftPoint,
    commitDraftPolygon,
    cancelDraft,
  }
}
