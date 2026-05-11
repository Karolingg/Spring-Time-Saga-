import { useEffect, useRef } from 'react'
import type { MouseEvent, PointerEvent, WheelEvent } from 'react'
import type { EditorTool, MapLayout, Point, Rect, ViewBox, ZoneType } from '@/src/features/map-editor/map-types'
import type { SimulationState } from '@/src/features/map-editor/simulation-types'
import { getZonePoints, isPointInZone } from '@/src/features/map-editor/zone-utils'

interface MapEditorCanvasProps {
  mapLayout: MapLayout
  viewBox: ViewBox
  tool: EditorTool
  zoneType: ZoneType
  selectedZoneId: string | null
  draftRect: Rect | null
  draftPolygon: Point[]
  simulationState: SimulationState | null
  onSelectZone: (point: Point) => void
  onMoveZone: (delta: Point) => void
  onMoveVertex: (index: number, point: Point) => void
  onDraftRect: (start: Point, end: Point) => void
  onCommitRect: () => void
  onAddPolygonPoint: (point: Point) => void
  onCommitPolygon: () => void
  onCancelDraft: () => void
  onPan: (delta: Point, bounds: Point) => void
  onZoom: (scale: number, focus: Point, bounds: Point) => void
}

export function MapEditorCanvas({
  mapLayout,
  viewBox,
  tool,
  zoneType,
  selectedZoneId,
  draftRect,
  draftPolygon,
  simulationState,
  onSelectZone,
  onMoveZone,
  onMoveVertex,
  onDraftRect,
  onCommitRect,
  onAddPolygonPoint,
  onCommitPolygon,
  onCancelDraft,
  onPan,
  onZoom,
}: MapEditorCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<{
    mode: 'pan' | 'rect' | 'move' | 'vertex'
    start: Point
    vertexIndex?: number
  } | null>(null)

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const point = getSvgPoint(event, svgRef.current, viewBox)
    if (tool === 'pan') {
      dragRef.current = { mode: 'pan', start: point }
      return
    }
    if (tool === 'rect') {
      dragRef.current = { mode: 'rect', start: point }
      onDraftRect(point, point)
      return
    }
    if (tool === 'select') {
      const zoneAtPoint = findZoneAtPoint(point, mapLayout.zones)
      onSelectZone(point)
      if (zoneAtPoint && selectedZoneId === zoneAtPoint.id) {
        dragRef.current = { mode: 'move', start: point }
      }
    }
  }

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || !dragRef.current) return
    const point = getSvgPoint(event, svgRef.current, viewBox)
    const delta = { x: point.x - dragRef.current.start.x, y: point.y - dragRef.current.start.y }

    if (dragRef.current.mode === 'pan') {
      onPan(delta, { x: mapLayout.image.width, y: mapLayout.image.height })
      dragRef.current.start = point
    }

    if (dragRef.current.mode === 'rect') {
      onDraftRect(dragRef.current.start, point)
    }

    if (dragRef.current.mode === 'move') {
      onMoveZone(delta)
      dragRef.current.start = point
    }

    if (dragRef.current.mode === 'vertex' && dragRef.current.vertexIndex !== undefined) {
      onMoveVertex(dragRef.current.vertexIndex, point)
    }
  }

  const handlePointerUp = () => {
    if (!dragRef.current) return
    if (dragRef.current.mode === 'rect') onCommitRect()
    dragRef.current = null
  }

  const handleDoubleClick = (event: MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || tool !== 'polygon') return
    event.preventDefault()
    onCommitPolygon()
  }

  const handleClick = (event: MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || tool !== 'polygon') return
    const point = getSvgPoint(event, svgRef.current, viewBox)
    onAddPolygonPoint(point)
  }

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    event.preventDefault()
    const scale = event.deltaY > 0 ? 1.1 : 0.9
    const point = getSvgPoint(event, svgRef.current, viewBox)
    onZoom(scale, point, { x: mapLayout.image.width, y: mapLayout.image.height })
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancelDraft()
      if (event.key === 'Enter') onCommitPolygon()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancelDraft, onCommitPolygon])

  return (
    <div className="map-editor__canvas-shell">
      <svg
        ref={svgRef}
        className={buildCanvasClass(tool)}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onClick={handleClick}
        onWheel={handleWheel}
      >
        <image href={mapLayout.image.src} width={mapLayout.image.width} height={mapLayout.image.height} />
        {mapLayout.zones.map((zone) => (
          <ZoneShape
            key={zone.id}
            zone={zone}
            isSelected={zone.id === selectedZoneId}
            onStartVertexDrag={(index, event) => {
              if (!svgRef.current) return
              event.stopPropagation()
              const point = getSvgPoint(event, svgRef.current, viewBox)
              dragRef.current = { mode: 'vertex', start: point, vertexIndex: index }
            }}
          />
        ))}
        {draftRect && <rect className={getZoneClass(zoneType, false)} x={draftRect.x} y={draftRect.y} width={draftRect.width} height={draftRect.height} />}
        {draftPolygon.length > 0 && (
          <polyline className={getZoneClass(zoneType, false)} points={draftPolygon.map((p) => `${p.x},${p.y}`).join(' ')} />
        )}
        {simulationState?.agents.map((agent) => (
          <circle key={agent.id} className="map-editor__agent" cx={agent.position.x} cy={agent.position.y} r="3" />
        ))}
      </svg>
    </div>
  )
}

interface ZoneShapeProps {
  zone: MapLayout['zones'][number]
  isSelected: boolean
  onStartVertexDrag: (index: number, event: PointerEvent<SVGCircleElement>) => void
}

function ZoneShape({ zone, isSelected, onStartVertexDrag }: ZoneShapeProps) {
  const points = getZonePoints(zone)
  const className = getZoneClass(zone.type, isSelected)

  return (
    <g>
      <polygon className={className} points={points.map((p) => `${p.x},${p.y}`).join(' ')} />
      {isSelected && points.map((point, index) => (
        <circle
          key={`${zone.id}-handle-${index}`}
          className="map-editor__handle"
          cx={point.x}
          cy={point.y}
          r="5"
          onPointerDown={(event) => onStartVertexDrag(index, event)}
        />
      ))}
      <text className="map-editor__zone-label" x={points[0]?.x ?? 0} y={(points[0]?.y ?? 0) - 6}>
        {zone.name}
      </text>
    </g>
  )
}

function buildCanvasClass(tool: EditorTool): string {
  const base = 'map-editor__canvas'
  if (tool === 'pan') return `${base} map-editor__canvas--pan`
  if (tool === 'rect' || tool === 'polygon') return `${base} map-editor__canvas--drawing`
  return base
}

function getZoneClass(type: ZoneType, selected: boolean): string {
  const base = `map-editor__zone map-editor__zone--${type}`
  return selected ? `${base} map-editor__zone--selected` : base
}

function getSvgPoint(event: { clientX: number; clientY: number }, svg: SVGSVGElement, viewBox: ViewBox): Point {
  const rect = svg.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * viewBox.width + viewBox.x
  const y = ((event.clientY - rect.top) / rect.height) * viewBox.height + viewBox.y
  return { x, y }
}

function findZoneAtPoint(point: Point, zones: MapLayout['zones']): MapLayout['zones'][number] | null {
  const hit = [...zones].reverse().find((zone) => isPointInZone(point, zone))
  return hit ?? null
}
