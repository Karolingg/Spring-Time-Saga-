'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Map, { Source, Layer, NavigationControl, Marker } from 'react-map-gl/mapbox'
import type { MapRef, MapMouseEvent } from 'react-map-gl/mapbox'
import type { FillExtrusionLayerSpecification, FillLayerSpecification, LineLayerSpecification } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

const FALLBACK_CENTER: [number, number] = [10.3230, 123.8995] // lat, lng — UP Cebu campus center
const DEFAULT_ZOOM = 16.5
const DEFAULT_PITCH = 45
const DEFAULT_BEARING = -15

/* ── Map style options ── */
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
    id: 'satellite',
    label: 'Satellite',
    url: 'mapbox://styles/mapbox/satellite-streets-v12',
    polygonColor: 'rgba(250,204,21,0.2)',
    glowColor: '#facc15',
  },
  {
    id: 'streets',
    label: 'Streets',
    url: 'mapbox://styles/mapbox/streets-v12',
    polygonColor: 'rgba(45,184,176,0.12)',
    glowColor: '#2db8b0',
  },
]

/* ── GeoJSON conversion ── */
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

/* ── Public types ── */
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
}

interface MapViewProps {
  regions?: MapRegion[]
  markers?: MapMarker[]
  onRegionClick?: (id: string) => void
  onBuildingClick?: (name: string, coords: [number, number]) => void
  maxBounds?: [[number, number], [number, number]]
  minZoom?: number
  lockedStyle?: string // force a single style and hide the switcher
  flat2d?: boolean // flat 2D view — no pitch, no extrusions, fill polygons only
  hoverOnly?: boolean // regions invisible by default, shown only on hover or selection
}

export default function MapView({ regions, markers, onRegionClick, onBuildingClick, maxBounds, minZoom, lockedStyle, flat2d, hoverOnly }: MapViewProps) {
  const mapRef = useRef<MapRef>(null)
  const [activeStyleId, setActiveStyleId] = useState(lockedStyle || 'outdoors')
  const [styleMenuOpen, setStyleMenuOpen] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [markersReady, setMarkersReady] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const activeStyle = MAP_STYLES.find((s) => s.id === activeStyleId) || MAP_STYLES[0]
  const isDark = activeStyleId === 'outdoors'

  const geojson = useMemo(() => regionsToGeoJSON(regions ?? [], hoverOnly ? hoveredId : undefined), [regions, hoverOnly, hoveredId])

  const canRenderMarkers = useMemo(() => {
    if (!markersReady || !markers?.length) return false
    const map = mapRef.current?.getMap()
    return Boolean(map?.getCanvasContainer())
  }, [markersReady, markers])

  // Delay marker rendering until map is fully ready
  useEffect(() => {
    if (!mapLoaded) {
      setMarkersReady(false)
      return
    }
    const timer = setTimeout(() => {
      const map = mapRef.current?.getMap()
      setMarkersReady(Boolean(map?.getCanvasContainer()))
    }, 100)
    return () => clearTimeout(timer)
  }, [mapLoaded])

  // Add Mapbox built-in 3D buildings from vector tiles (skip in flat 2D mode)
  useEffect(() => {
    if (!mapLoaded || flat2d) return
    const map = mapRef.current?.getMap()
    if (!map) return

    const add3DBuildings = () => {
      if (map.getLayer('mapbox-3d-buildings')) return

      // Insert below the first symbol layer so labels stay on top
      const layers = map.getStyle()?.layers
      let labelLayerId: string | undefined
      if (layers) {
        for (const layer of layers) {
          if (layer.type === 'symbol' && (layer as any).layout?.['text-field']) {
            labelLayerId = layer.id
            break
          }
        }
      }

      map.addLayer(
        {
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
        } as any,
        labelLayerId,
      )
    }

    if (map.isStyleLoaded()) {
      add3DBuildings()
    }
    map.on('style.load', add3DBuildings)
    return () => {
      map.off('style.load', add3DBuildings)
    }
  }, [mapLoaded])

  // Fly to center using Nominatim (skip when style is locked — page controls its own bounds)
  useEffect(() => {
    if (!mapLoaded || lockedStyle) return

    const searchUrl =
      `https://nominatim.openstreetmap.org/search` +
      `?q=UP+High+School+Cebu&countrycodes=ph&format=json&limit=1` +
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
        mapRef.current?.flyTo({
          center: [lng, lat],
          zoom: DEFAULT_ZOOM,
          pitch: flat2d ? 0 : DEFAULT_PITCH,
          bearing: flat2d ? 0 : DEFAULT_BEARING,
          duration: 1500,
        })
      })
      .catch(() => {
      })
  }, [mapLoaded])

  // Click handler — prioritise custom region features over Mapbox 3D buildings
  const handleClick = useCallback(
    (e: MapMouseEvent) => {
      // Check ALL returned features for a custom region (has an id property)
      const regionFeature = e.features?.find(f => f.properties?.id)
      if (regionFeature?.properties?.id) {
        onRegionClick?.(regionFeature.properties.id)
        return
      }

      const feature = e.features?.[0]
      if (feature?.layer?.id === 'mapbox-3d-buildings' && onBuildingClick) {
        const name = feature.properties?.name || feature.properties?.type || 'Building'
        const [lng, lat] = e.lngLat ? [e.lngLat.lng, e.lngLat.lat] : [0, 0]
        onBuildingClick(name, [lat, lng])
      } else if (flat2d && onBuildingClick) {
        // In flat 2D mode, query all features at click point and find buildings
        const map = mapRef.current?.getMap()
        if (!map || !e.point) return
        let building: any
        try {
          const allFeatures = map.queryRenderedFeatures(e.point)
          building = allFeatures.find(f => f.sourceLayer === 'building')
        } catch { return }
        if (building) {
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

  // Expression: feature is visible (hovered or selected)
  const isVisible: any = ['any', ['==', ['get', 'selected'], 'true'], ['==', ['get', 'hovered'], 'true']]

  // Layer paint properties
  const glowLayer: LineLayerSpecification = {
    id: 'building-glow',
    type: 'line',
    source: 'campus-buildings',
    paint: {
      'line-color': activeStyle.glowColor,
      'line-width': [
        'case',
        ['==', ['get', 'selected'], 'true'], 10,
        4,
      ],
      'line-opacity': hoverOnly
        ? ['case', isVisible, ['case', ['==', ['get', 'selected'], 'true'], 0.5, 0.35], 0]
        : ['case', ['==', ['get', 'selected'], 'true'], 0.5, 0.2],
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
        ['==', ['get', 'selected'], 'true'], activeStyle.glowColor,
        activeStyle.polygonColor,
      ],
      'fill-opacity': hoverOnly
        ? ['case', isVisible, ['case', ['==', ['get', 'selected'], 'true'], 0.6, 0.35], 0]
        : ['case', ['==', ['get', 'selected'], 'true'], 0.6, 0.35],
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
        ['==', ['get', 'selected'], 'true'], 3,
        1.5,
      ],
      'line-opacity': hoverOnly
        ? ['case', isVisible, ['case', ['==', ['get', 'selected'], 'true'], 1, 0.7], 0]
        : ['case', ['==', ['get', 'selected'], 'true'], 1, 0.7],
    },
  }

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
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

        {/* Building markers */}
        {canRenderMarkers && markers?.map((m) => (
          <Marker
            key={m.id}
            longitude={m.lng}
            latitude={m.lat}
            anchor="bottom"
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
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'rgba(45,184,176,0.9)', border: '2px solid #fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4), 0 0 12px rgba(45,184,176,0.4)',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
                </svg>
              </div>
              <div style={{
                background: 'rgba(10,15,28,0.9)', color: '#f1f5f9',
                padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '600',
                whiteSpace: 'nowrap', border: '1px solid rgba(255,255,255,0.1)',
                maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {m.label}
              </div>
            </div>
          </Marker>
        ))}

        {regions && regions.length > 0 && (
          <Source id="campus-buildings" type="geojson" data={geojson}>
            <Layer {...glowLayer} />
            {flat2d ? <Layer {...flatFillLayer} /> : <Layer {...extrusionLayer} />}
            <Layer {...outlineLayer} />
          </Source>
        )}
      </Map>

      {/* Style switcher — hidden when style is locked or flat 2D mode */}
      {!lockedStyle && !flat2d && <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1000 }}>
        <button
          onClick={() => setStyleMenuOpen(!styleMenuOpen)}
          style={{
            background: isDark ? 'rgba(15,23,42,0.9)' : '#fff',
            color: isDark ? '#e2e8f0' : '#1a2332',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            borderRadius: '10px', padding: '8px 14px', fontSize: '13px',
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)', transition: 'all 0.2s',
            backdropFilter: 'blur(8px)',
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
            background: isDark ? 'rgba(15,23,42,0.95)' : '#fff',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            borderRadius: '10px', overflow: 'hidden', minWidth: '160px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
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
                    ? (isDark ? 'rgba(45,184,176,0.1)' : '#f0fdfa')
                    : 'transparent',
                  color: isDark ? '#e2e8f0' : '#1a2332',
                  fontSize: '13px', fontWeight: style.id === activeStyleId ? 600 : 400,
                  cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (style.id !== activeStyleId)
                    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc'
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
                    ? `0 0 0 2px ${isDark ? 'rgba(15,23,42,0.9)' : '#fff'}, 0 0 0 4px ${style.glowColor}`
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
