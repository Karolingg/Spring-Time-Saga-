'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Map, { Source, Layer, NavigationControl, Marker } from 'react-map-gl/mapbox'
import type { MapRef, MapMouseEvent } from 'react-map-gl/mapbox'
import type { FillExtrusionLayerSpecification, FillLayerSpecification, GeoJSONFeature, LineLayerSpecification, SymbolLayerSpecification } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

const FALLBACK_CENTER: [number, number] = [10.3230, 123.8995] // lat, lng â€” UP Cebu campus center
const DEFAULT_ZOOM = 18
const DEFAULT_PITCH = 45
const DEFAULT_BEARING = 0
const SELECTED_REGION_ZOOM = 18.2
const SELECTED_REGION_PITCH = 58

/* â”€â”€ Map style options â”€â”€ */
interface MapStyleOption {
  id: string
  label: string
  url: string
  polygonColor: string
  glowColor: string
}

const MAP_STYLES: MapStyleOption[] = [
  {
    id: 'outdoors',
    label: 'Cycle Map',
    url: 'mapbox://styles/mapbox/outdoors-v12',
    polygonColor: 'rgba(45,184,176,0.15)',
    glowColor: '#2db8b0',
  },
  {
    id: 'dark',
    label: 'Dark',
    url: 'mapbox://styles/mapbox/dark-v11',
    polygonColor: 'rgba(45,184,176,0.15)',
    glowColor: '#2db8b0',
  },
  {
    id: 'light',
    label: 'Light',
    url: 'mapbox://styles/mapbox/light-v11',
    polygonColor: 'rgba(45,184,176,0.12)',
    glowColor: '#2db8b0',
  },
  {
    id: 'streets',
    label: 'Streets',
    url: 'mapbox://styles/mapbox/streets-v12',
    polygonColor: 'rgba(45,184,176,0.12)',
    glowColor: '#2db8b0',
  },
]

/* â”€â”€ GeoJSON conversion â”€â”€ */
function regionsToGeoJSON(regions: MapRegion[], hoveredId?: string | null): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: regions.map((r) => {
      const coords = r.polygon.map(([lat, lng]) => [lng, lat])
      // Close the ring
      if (coords.length > 0) {
        coords.push([...coords[0]])
      }
      return {
        type: 'Feature' as const,
        id: r.id,
        properties: {
          id: r.id,
          selected: r.selected ? 'true' : 'false',
          hovered: r.id === hoveredId ? 'true' : 'false',
          floors: r.floors ?? 1,
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [coords],
        },
      }
    }),
  }
}

/* â”€â”€ Public types â”€â”€ */
export interface MapRegion {
  id: string
  polygon: [number, number][] // [lat, lng] pairs
  selected?: boolean
  floors?: number // drives 3D extrusion height
}

export interface MapMarker {
  id: string
  label: string
  lat: number
  lng: number
  onClick?: () => void
  compact?: boolean // small dot marker, no label
}

interface MapViewProps {
  regions?: MapRegion[]
  markers?: MapMarker[]
  onRegionClick?: (id: string) => void
  onBuildingClick?: (name: string, coords: [number, number]) => void
  focusCenter?: [number, number] | null
  highlightAt?: [number, number] | null // [lat, lng] — after flying there, outline the Mapbox building at that point
  maxBounds?: [[number, number], [number, number]]
  minZoom?: number
  maxZoom?: number
  lockedStyle?: string // force a single style and hide the switcher
  flat2d?: boolean // flat 2D view â€” no pitch, no extrusions, fill polygons only
  hoverOnly?: boolean // regions invisible by default, shown only on hover or selection
  uiOffsetRight?: number
}

export default function MapView({ regions, markers, onRegionClick, onBuildingClick, focusCenter, highlightAt, maxBounds, minZoom, maxZoom, lockedStyle, flat2d, hoverOnly, uiOffsetRight = 0 }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapRef>(null)
  const hadSelectedRegionRef = useRef(false)
  const [activeStyleId, setActiveStyleId] = useState(lockedStyle || 'outdoors')
  const [styleMenuOpen, setStyleMenuOpen] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [markersReady, setMarkersReady] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedMapboxBuildingId, setSelectedMapboxBuildingId] = useState<string | number | null>(null)
  const [selectedMapboxBuildingPropertyId, setSelectedMapboxBuildingPropertyId] = useState<string | number | null>(null)
  const [defaultCenter, setDefaultCenter] = useState<[number, number]>([FALLBACK_CENTER[1], FALLBACK_CENTER[0]]) // [lng, lat]

  const activeStyle = MAP_STYLES.find((s) => s.id === activeStyleId) || MAP_STYLES[0]

  const geojson = useMemo(() => regionsToGeoJSON(regions ?? [], hoverOnly ? hoveredId : undefined), [regions, hoverOnly, hoveredId])
  const canRenderMarkers = mapLoaded && markersReady && Boolean(markers?.length)
  const uiTransform = uiOffsetRight > 0 ? `translateX(-${uiOffsetRight}px)` : 'translateX(0px)'

  // Delay marker rendering until map is fully ready
  useEffect(() => {
    if (!mapLoaded) return
    const timer = setTimeout(() => {
      const map = mapRef.current?.getMap()
      setMarkersReady(Boolean(map?.getCanvasContainer()))
    }, 100)
    return () => clearTimeout(timer)
  }, [mapLoaded])

  // Keep WebGL canvas synced with layout changes (e.g., side panel open/close)
  // so no blank strip appears when the map container width animates.
  useEffect(() => {
    if (!mapLoaded) return
    const map = mapRef.current?.getMap()
    const container = containerRef.current
    if (!map || !container) return

    let rafId: number | null = null
    let settleTimer: ReturnType<typeof setTimeout> | null = null

    const runResize = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        map.resize()
      })
      if (settleTimer) clearTimeout(settleTimer)
      settleTimer = setTimeout(() => {
        map.resize()
      }, 320)
    }

    runResize()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', runResize)
      return () => {
        window.removeEventListener('resize', runResize)
        if (rafId !== null) cancelAnimationFrame(rafId)
        if (settleTimer) clearTimeout(settleTimer)
      }
    }

    const observer = new ResizeObserver(() => runResize())
    observer.observe(container)

    return () => {
      observer.disconnect()
      if (rafId !== null) cancelAnimationFrame(rafId)
      if (settleTimer) clearTimeout(settleTimer)
    }
  }, [mapLoaded, flat2d])

  // Add Mapbox built-in 3D buildings from vector tiles (skip in flat 2D mode)
  useEffect(() => {
    if (!mapLoaded || flat2d) return
    const map = mapRef.current?.getMap()
    if (!map) return

    const add3DBuildings = () => {
      if (map.getLayer('mapbox-3d-buildings')) {
        return
      }

      // Insert below the first symbol layer so labels stay on top
      const layers = map.getStyle()?.layers
      let labelLayerId: string | undefined
      if (layers) {
        for (const layer of layers) {
          if (layer.type === 'symbol') {
            const symbolLayer = layer as SymbolLayerSpecification
            if (!symbolLayer.layout?.['text-field']) continue
            labelLayerId = layer.id
            break
          }
        }
      }

      const mapboxBuildingsLayer: FillExtrusionLayerSpecification = {
        id: 'mapbox-3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'],
            14, 0,
            14.05, ['get', 'height'],
          ],
          'fill-extrusion-base': [
            'interpolate', ['linear'], ['zoom'],
            14, 0,
            14.05, ['get', 'min_height'],
          ],
          'fill-extrusion-opacity': 0.5,
        },
      }

      map.addLayer(mapboxBuildingsLayer, labelLayerId)
    }

    if (map.isStyleLoaded()) {
      add3DBuildings()
    }
    map.on('style.load', add3DBuildings)
    return () => {
      map.off('style.load', add3DBuildings)
    }
  }, [mapLoaded, flat2d])

  // Fly to center using Nominatim (skip when style is locked â€” page controls its own bounds)
  useEffect(() => {
    if (!mapLoaded || lockedStyle) return

    const searchUrl =
      `https://nominatim.openstreetmap.org/search` +
      `?q=University+of+the+Philippines+Cebu%2C+Lahug%2C+Cebu+City&countrycodes=ph&format=json&limit=1` +
      `&polygon_geojson=1&addressdetails=0`

    fetch(searchUrl, { headers: { 'Accept-Language': 'en' } })
      .then((r) => {
        if (!r.ok) throw new Error(`Nominatim ${r.status}`)
        return r.json()
      })
      .then((results) => {
        if (!results.length) return
        const result = results[0]
        const lat = parseFloat(result.lat)
        const lng = parseFloat(result.lon)
        setDefaultCenter([lng, lat])
        // Only re-center if the caller didn't already supply a focus target.
        if (!focusCenter) {
          mapRef.current?.flyTo({
            center: [lng, lat],
            zoom: DEFAULT_ZOOM,
            pitch: flat2d ? 0 : DEFAULT_PITCH,
            bearing: flat2d ? 0 : DEFAULT_BEARING,
            duration: 1500,
          })
        }
      })
      .catch(() => {
      })
  // Intentionally only re-run when the map mounts or lockedStyle changes — we don't want
  // flat2d toggles (e.g. from selecting a building) to re-trigger a fly to the geocoded default.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, lockedStyle])

  useEffect(() => {
    if (!mapLoaded || !focusCenter) return
    mapRef.current?.flyTo({
      center: focusCenter,
      zoom: flat2d ? 17.6 : 18.3,
      pitch: flat2d ? 0 : 55,
      bearing: flat2d ? 0 : DEFAULT_BEARING,
      duration: 1200,
      essential: true,
    })
  }, [mapLoaded, focusCenter, flat2d])

  // Outline the Mapbox building at `highlightAt` immediately, then keep retrying as tiles/render update.
  useEffect(() => {
    if (!mapLoaded) return
    const map = mapRef.current?.getMap()
    if (!map) return
    if (!highlightAt) {
      setSelectedMapboxBuildingId(null)
      setSelectedMapboxBuildingPropertyId(null)
      return
    }
    const [lat, lng] = highlightAt
    const trySelect = (): boolean => {
      try {
        const point = map.project([lng, lat])
        const radius = 24 // widen the hit-test — a single pixel often misses roof geometry
        const bbox: [[number, number], [number, number]] = [
          [point.x - radius, point.y - radius],
          [point.x + radius, point.y + radius],
        ]
        const queryLayers = ['mapbox-3d-buildings', 'building-fills'].filter((layerId) => Boolean(map.getLayer(layerId)))
        let features = queryLayers.length
          ? map.queryRenderedFeatures(bbox, { layers: queryLayers })
          : map.queryRenderedFeatures(bbox)
        if (!features.length && queryLayers.length) {
          features = map.queryRenderedFeatures(bbox)
        }
        const building = features.find((f) => f.sourceLayer === 'building')
        if (building) {
          setSelectedMapboxBuildingId(building.id ?? null)
          setSelectedMapboxBuildingPropertyId((building.properties?.id as string | number | undefined) ?? null)
          return true
        }
      } catch {
        // style/source not ready yet
      }
      return false
    }

    let rafId: number | null = null
    let active = true
    const startedAt = Date.now()
    const maxRetryWindowMs = 1800

    const stop = () => {
      active = false
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      map.off('moveend', onMoveEnd)
      map.off('render', onRender)
      map.off('idle', onIdle)
    }

    const loopSelect = () => {
      if (!active) return
      if (trySelect()) {
        stop()
        return
      }
      if (Date.now() - startedAt < maxRetryWindowMs) {
        rafId = requestAnimationFrame(loopSelect)
      }
    }

    const onRender = () => {
      if (trySelect()) stop()
    }

    const onMoveEnd = () => {
      if (trySelect()) stop()
    }

    const onIdle = () => {
      if (trySelect()) stop()
    }

    // Try immediately for cases where the feature is already in view.
    loopSelect()
    map.on('render', onRender)
    map.on('moveend', onMoveEnd)
    map.on('idle', onIdle)

    return () => {
      stop()
    }
  }, [mapLoaded, highlightAt])

  // Smoothly zoom into selected regions and ease back to the default view on deselect.
  useEffect(() => {
    if (!mapLoaded || !regions?.length) return
    const map = mapRef.current?.getMap()
    if (!map) return

    const selectedRegion = regions.find((r) => Boolean(r.selected))

    if (selectedRegion?.polygon?.length) {
      hadSelectedRegionRef.current = true

      const firstPoint = selectedRegion.polygon[0]
      if (!firstPoint) return

      let minLat = firstPoint[0]
      let maxLat = firstPoint[0]
      let minLng = firstPoint[1]
      let maxLng = firstPoint[1]
      let sumLat = 0
      let sumLng = 0

      for (const [lat, lng] of selectedRegion.polygon) {
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
        minLng = Math.min(minLng, lng)
        maxLng = Math.max(maxLng, lng)
        sumLat += lat
        sumLng += lng
      }

      const centerLat = sumLat / selectedRegion.polygon.length
      const centerLng = sumLng / selectedRegion.polygon.length
      const latSpan = Math.max(maxLat - minLat, 0.00008)
      const lngSpan = Math.max(maxLng - minLng, 0.00008)
      const isLargeRegion = latSpan > 0.001 || lngSpan > 0.001

      if (isLargeRegion) {
        map.fitBounds(
          [[minLng, minLat], [maxLng, maxLat]],
          {
            padding: { top: 90, right: 90, bottom: 90, left: 90 },
            duration: 1100,
            maxZoom: flat2d ? 17.6 : 17.8,
            pitch: flat2d ? 0 : SELECTED_REGION_PITCH,
            bearing: flat2d ? 0 : DEFAULT_BEARING,
            essential: true,
          },
        )
        return
      }

      map.flyTo({
        center: [centerLng, centerLat],
        zoom: flat2d ? 17.6 : SELECTED_REGION_ZOOM,
        pitch: flat2d ? 0 : SELECTED_REGION_PITCH,
        bearing: flat2d ? 0 : DEFAULT_BEARING,
        duration: 1000,
        essential: true,
      })
      return
    }

    if (hadSelectedRegionRef.current) {
      hadSelectedRegionRef.current = false
      map.easeTo({
        center: defaultCenter,
        zoom: DEFAULT_ZOOM,
        pitch: flat2d ? 0 : DEFAULT_PITCH,
        bearing: flat2d ? 0 : DEFAULT_BEARING,
        duration: 1300,
        easing: (t) => 1 - Math.pow(1 - t, 3),
        essential: true,
      })
    }
  }, [mapLoaded, regions, flat2d, defaultCenter])

  // Click handler: prioritise custom region features over Mapbox 3D buildings.
  const handleClick = useCallback(
    (e: MapMouseEvent) => {
      // Prefer real Mapbox building feature for precise footprint highlighting.
      const mapboxBuildingFeature = e.features?.find(
        (f) => f.layer?.id === 'mapbox-3d-buildings' || f.sourceLayer === 'building',
      )

      if (mapboxBuildingFeature && onBuildingClick) {
        setSelectedMapboxBuildingId(mapboxBuildingFeature.id ?? null)
        setSelectedMapboxBuildingPropertyId((mapboxBuildingFeature.properties?.id as string | number | undefined) ?? null)
        const name = mapboxBuildingFeature.properties?.name || mapboxBuildingFeature.properties?.type || 'Building'
        const [lng, lat] = e.lngLat ? [e.lngLat.lng, e.lngLat.lat] : [0, 0]
        onBuildingClick(name, [lat, lng])
        return
      }

      // Check ALL returned features for a custom region (has an id property)
      const regionFeature = e.features?.find(f => f.properties?.id)
      if (regionFeature?.properties?.id) {
        setSelectedMapboxBuildingId(null)
        setSelectedMapboxBuildingPropertyId(null)
        onRegionClick?.(regionFeature.properties.id)
        return
      }

      if (flat2d && onBuildingClick) {
        // In flat 2D mode, query all features at click point and find buildings
        const map = mapRef.current?.getMap()
        if (!map || !e.point) return
        let building: GeoJSONFeature | undefined
        try {
          const allFeatures = map.queryRenderedFeatures(e.point)
          building = allFeatures.find(f => f.sourceLayer === 'building')
        } catch { return }
        if (building) {
          setSelectedMapboxBuildingId(building.id ?? null)
          setSelectedMapboxBuildingPropertyId((building.properties?.id as string | number | undefined) ?? null)
          const name = building.properties?.name || building.properties?.type || 'Building'
          const [lng, lat] = e.lngLat ? [e.lngLat.lng, e.lngLat.lat] : [0, 0]
          onBuildingClick(name, [lat, lng])
        }
      }
    },
    [onRegionClick, onBuildingClick, flat2d],
  )

  // Hover handlers
  const handleMouseEnter = useCallback((e: MapMouseEvent) => {
    const map = mapRef.current?.getMap()
    if (map) map.getCanvas().style.cursor = 'pointer'
    const feature = e.features?.[0]
    if (feature?.properties?.id) {
      setHoveredId(feature.properties.id)
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (map) map.getCanvas().style.cursor = ''
    setHoveredId(null)
  }, [])

  // In flat 2D mode, show pointer cursor over base-style buildings
  const handleMouseMove = useCallback((e: MapMouseEvent) => {
    if (!flat2d || !onBuildingClick) return
    const map = mapRef.current?.getMap()
    if (!map || !e.point) return
    try {
      const allFeatures = map.queryRenderedFeatures(e.point)
      const hasBuilding = allFeatures.some(f => f.sourceLayer === 'building')
      map.getCanvas().style.cursor = hasBuilding ? 'pointer' : ''
    } catch {
      // queryRenderedFeatures can throw if style isn't loaded yet
    }
  }, [flat2d, onBuildingClick])

  // If a real Mapbox building is selected, suppress selected styling on custom polygons
  // so the exact Mapbox footprint outline is visually authoritative.
  const hasSelectedMapboxBuilding = selectedMapboxBuildingId !== null || selectedMapboxBuildingPropertyId !== null
  const suppressCustomSelectedStyle = hasSelectedMapboxBuilding
  const selectedExpr = suppressCustomSelectedStyle
    ? ['==', ['get', 'id'], '__none__']
    : ['==', ['get', 'selected'], 'true']

  // Expression: feature is visible (hovered or selected)
  const isVisible = ['any', selectedExpr, ['==', ['get', 'hovered'], 'true']]

  // Layer paint properties
  const glowLayer: LineLayerSpecification = {
    id: 'building-glow',
    type: 'line',
    source: 'campus-buildings',
    paint: {
      'line-color': activeStyle.glowColor,
      'line-width': [
        'case',
        selectedExpr, 10,
        4,
      ],
      'line-opacity': hoverOnly
        ? ['case', isVisible, ['case', selectedExpr, 0.5, 0.35], 0]
        : ['case', selectedExpr, 0.5, 0.2],
      'line-blur': 6,
    },
  }

  const extrusionLayer: FillExtrusionLayerSpecification = {
    id: 'building-fills',
    type: 'fill-extrusion',
    source: 'campus-buildings',
    ...(hoverOnly ? { filter: isVisible } : {}),
    paint: {
      'fill-extrusion-color': activeStyle.glowColor,
      'fill-extrusion-height': ['*', ['get', 'floors'], 12],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.6,
    },
  }

  const flatFillLayer: FillLayerSpecification = {
    id: 'building-fills-flat',
    type: 'fill',
    source: 'campus-buildings',
    paint: {
      'fill-color': [
        'case',
        selectedExpr, activeStyle.glowColor,
        activeStyle.polygonColor,
      ],
      'fill-opacity': hoverOnly
        ? ['case', isVisible, ['case', selectedExpr, 0.6, 0.35], 0]
        : ['case', selectedExpr, 0.6, 0.35],
    },
  }

  const outlineLayer: LineLayerSpecification = {
    id: 'building-outlines',
    type: 'line',
    source: 'campus-buildings',
    paint: {
      'line-color': activeStyle.glowColor,
      'line-width': [
        'case',
        selectedExpr, 3,
        1.5,
      ],
      'line-opacity': hoverOnly
        ? ['case', isVisible, ['case', selectedExpr, 1, 0.7], 0]
        : ['case', selectedExpr, 1, 0.7],
    },
  }

  const selectedMapboxBuildingFilter = useMemo(() => {
    if (selectedMapboxBuildingId === null && selectedMapboxBuildingPropertyId === null) {
      return null
    }

    if (selectedMapboxBuildingId !== null && selectedMapboxBuildingPropertyId !== null) {
      return ['any', ['==', ['id'], selectedMapboxBuildingId], ['==', ['get', 'id'], selectedMapboxBuildingPropertyId]]
    }
    if (selectedMapboxBuildingId !== null) {
      return ['==', ['id'], selectedMapboxBuildingId]
    }
    if (selectedMapboxBuildingPropertyId !== null) {
      return ['==', ['get', 'id'], selectedMapboxBuildingPropertyId]
    }
    return null
  }, [selectedMapboxBuildingId, selectedMapboxBuildingPropertyId])

  const selectedMapboxBuildingExtrudeFilter = useMemo(() => {
    if (!selectedMapboxBuildingFilter) return null
    return ['all', ['==', ['get', 'extrude'], 'true'], selectedMapboxBuildingFilter]
  }, [selectedMapboxBuildingFilter])

  return (
    <div ref={containerRef} className="map-view-shell" style={{ position: 'relative', height: '100%', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
      <style>{`
        .map-view-shell .mapboxgl-ctrl-bottom-right {
          transform: ${uiTransform};
          transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
        }
      `}</style>
      {/* Token warning */}
      {!MAPBOX_TOKEN && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 1000, background: 'rgba(15,23,42,0.95)', border: '1px solid #334155',
          borderRadius: '12px', padding: '24px 32px', textAlign: 'center', maxWidth: '360px',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', marginBottom: '8px' }}>
            Mapbox token required
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.6 }}>
            Add your token to <code style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px', color: '#2db8b0' }}>.env.local</code> as <code style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px', color: '#2db8b0' }}>NEXT_PUBLIC_MAPBOX_TOKEN</code>
          </div>
        </div>
      )}

      {/* Map */}
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: lockedStyle ? 123.9000 : FALLBACK_CENTER[1],
          latitude: lockedStyle ? 10.3230 : FALLBACK_CENTER[0],
          zoom: lockedStyle ? 16.5 : DEFAULT_ZOOM,
          pitch: (lockedStyle || flat2d) ? 0 : DEFAULT_PITCH,
          bearing: (lockedStyle || flat2d) ? 0 : DEFAULT_BEARING,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={activeStyle.url}
        maxBounds={maxBounds ? [
          [maxBounds[0][1], maxBounds[0][0]],
          [maxBounds[1][1], maxBounds[1][0]],
        ] : undefined}
        minZoom={minZoom}
        maxZoom={maxZoom}
        interactiveLayerIds={flat2d ? [] : ['building-fills', 'mapbox-3d-buildings']}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={flat2d ? handleMouseMove : undefined}
        onLoad={() => setMapLoaded(true)}
        onRemove={() => {
          setMapLoaded(false)
          setMarkersReady(false)
        }}
      >
        <NavigationControl position="bottom-right" showCompass showZoom />

        {/* Exact selected building footprint overlay (stays aligned in all map angles/styles). */}
        {mapLoaded && selectedMapboxBuildingFilter && (
          <>
            {!flat2d && selectedMapboxBuildingExtrudeFilter && (
              <Layer
                id="selected-mapbox-building-fill"
                type="fill-extrusion"
                source="composite"
                source-layer="building"
                filter={selectedMapboxBuildingExtrudeFilter as unknown as FillExtrusionLayerSpecification['filter']}
                paint={{
                  'fill-extrusion-color': activeStyle.glowColor,
                  'fill-extrusion-height': ['get', 'height'],
                  'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
                  'fill-extrusion-opacity': 0.45,
                } as FillExtrusionLayerSpecification['paint']}
              />
            )}
            <Layer
              id="selected-mapbox-building-outline"
              type="line"
              source="composite"
              source-layer="building"
              filter={selectedMapboxBuildingFilter as unknown as LineLayerSpecification['filter']}
              paint={{
                'line-color': activeStyle.glowColor,
                'line-width': 3.5,
                'line-opacity': 0.95,
              } as LineLayerSpecification['paint']}
            />
          </>
        )}

        {/* Building markers */}
        {canRenderMarkers && markers?.map((m) => {
          const isCompact = Boolean(m.compact)
          const size = isCompact ? 20 : 32
          const iconSize = isCompact ? 10 : 16
          return (
            <Marker
              key={m.id}
              longitude={m.lng}
              latitude={m.lat}
              anchor={isCompact ? 'center' : 'bottom'}
              onClick={(e) => { e.originalEvent.stopPropagation(); m.onClick?.() }}
            >
              <div
                title={m.label}
                style={{
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                  transition: 'transform 0.15s', pointerEvents: 'auto',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div style={{
                  width: `${size}px`, height: `${size}px`, borderRadius: '50%',
                  background: 'rgba(45,184,176,0.9)', border: '2px solid #fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4), 0 0 12px rgba(45,184,176,0.4)',
                }}>
                  <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
                  </svg>
                </div>
                {!isCompact && m.label && (
                  <div style={{
                    background: 'rgba(10,15,28,0.9)', color: '#f1f5f9',
                    padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '600',
                    whiteSpace: 'nowrap', border: '1px solid rgba(255,255,255,0.1)',
                    maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {m.label}
                  </div>
                )}
              </div>
            </Marker>
          )
        })}

        {regions && regions.length > 0 && (
          <Source id="campus-buildings" type="geojson" data={geojson}>
            <Layer {...glowLayer} />
            {flat2d ? <Layer {...flatFillLayer} /> : <Layer {...extrusionLayer} />}
            <Layer {...outlineLayer} />
          </Source>
        )}
      </Map>

      {/* Style switcher â€” hidden when style is locked or flat 2D mode */}
      {!lockedStyle && !flat2d && <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1000, transform: uiTransform, transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)', willChange: 'transform' }}>
        <button
          onClick={() => setStyleMenuOpen(!styleMenuOpen)}
          style={{
            background: 'rgba(248,250,252,0.95)',
            color: '#1e293b',
            border: '1px solid rgba(148,163,184,0.22)',
            borderRadius: '12px', padding: '9px 14px', fontSize: '13px',
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 10px 24px rgba(15,23,42,0.14)', transition: 'all 0.2s',
            backdropFilter: 'blur(10px)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
          {activeStyle.label}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: styleMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {styleMenuOpen && (
          <div style={{
            position: 'absolute', top: '44px', right: '0',
            background: 'rgba(248,250,252,0.97)',
            border: '1px solid rgba(148,163,184,0.22)',
            borderRadius: '12px', overflow: 'hidden', minWidth: '168px',
            boxShadow: '0 14px 30px rgba(15,23,42,0.16)',
            backdropFilter: 'blur(12px)',
          }}>
            {MAP_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => { setActiveStyleId(style.id); setStyleMenuOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', padding: '10px 14px', border: 'none',
                  background: style.id === activeStyleId
                    ? 'rgba(45,184,176,0.12)'
                    : 'transparent',
                  color: '#1e293b',
                  fontSize: '13px', fontWeight: style.id === activeStyleId ? 600 : 400,
                  cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (style.id !== activeStyleId)
                    e.currentTarget.style.background = 'rgba(226,232,240,0.55)'
                }}
                onMouseLeave={(e) => {
                  if (style.id !== activeStyleId)
                    e.currentTarget.style.background = 'transparent'
                }}
              >
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: style.glowColor,
                  boxShadow: style.id === activeStyleId
                    ? `0 0 0 2px rgba(248,250,252,0.98), 0 0 0 4px ${style.glowColor}`
                    : 'none',
                }} />
                {style.label}
                {style.id === activeStyleId && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={style.glowColor} strokeWidth="2.5" style={{ marginLeft: 'auto' }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>}

    </div>
  )
}


