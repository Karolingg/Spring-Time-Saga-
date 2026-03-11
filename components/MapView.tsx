'use client'

import { useEffect, useState, useRef } from 'react'
import { MapContainer, Polygon, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons broken by webpack
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const FALLBACK_CENTER: [number, number] = [10.3311, 123.9009]
const DEFAULT_ZOOM = 18

type LatLng = [number, number]

interface TileOption {
  id: string
  label: string
  url: string
  attribution: string
  maxZoom: number
  polygonColor: string
  cssFilter?: string
}

const TILE_LAYERS: TileOption[] = [
  {
    id: 'standard',
    label: 'Default',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    polygonColor: '#2db8b0',
  },
  {
    id: 'light',
    label: 'Light',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 20,
    polygonColor: '#2db8b0',
  },
  {
    id: 'dark',
    label: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 20,
    polygonColor: '#5eead4',
    cssFilter: 'invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9) saturate(0.3)',
  },
  {
    id: 'satellite',
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19,
    polygonColor: '#facc15',
  },
  {
    id: 'topo',
    label: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
    polygonColor: '#e11d48',
  },
]

function FlyToCenter({ center }: { center: LatLng }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, DEFAULT_ZOOM, { duration: 1.2 })
  }, [center, map])
  return null
}

function TileLayerSwitcher({ activeLayer }: { activeLayer: TileOption }) {
  const map = useMap()
  const layerRef = useRef<L.TileLayer | null>(null)

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current)
    }
    const newLayer = L.tileLayer(activeLayer.url, {
      attribution: activeLayer.attribution,
      maxZoom: activeLayer.maxZoom,
    })
    newLayer.addTo(map)
    layerRef.current = newLayer

    const tilePane = map.getPane('tilePane')
    if (tilePane) {
      tilePane.style.filter = activeLayer.cssFilter ?? 'none'
    }

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
      }
    }
  }, [activeLayer, map])

  return null
}

/* ── Public types ── */
export interface MapRegion {
  id: string
  polygon: LatLng[]
  selected?: boolean
}

interface MapViewProps {
  regions?: MapRegion[]
  onRegionClick?: (id: string) => void
}

export default function MapView({ regions, onRegionClick }: MapViewProps) {
  const [center, setCenter] = useState<LatLng>(FALLBACK_CENTER)
  const [loadState, setLoadState] = useState<'loading' | 'success' | 'error'>('loading')
  const [ready, setReady] = useState(false)
  const [activeLayerId, setActiveLayerId] = useState('standard')
  const [layerMenuOpen, setLayerMenuOpen] = useState(false)

  const activeLayer = TILE_LAYERS.find(l => l.id === activeLayerId) || TILE_LAYERS[0]

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 300)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const searchUrl =
      `https://nominatim.openstreetmap.org/search` +
      `?q=UP+High+School+Cebu&countrycodes=ph&format=json&limit=1` +
      `&polygon_geojson=1&addressdetails=0`

    fetch(searchUrl, { headers: { 'Accept-Language': 'en' } })
      .then(r => {
        if (!r.ok) throw new Error(`Nominatim ${r.status}`)
        return r.json()
      })
      .then(results => {
        if (!results.length) throw new Error('Not found')
        const result = results[0]
        setCenter([parseFloat(result.lat), parseFloat(result.lon)])
        setLoadState('success')
      })
      .catch(() => setLoadState('error'))
  }, [])

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Status badge */}
      {loadState === 'loading' && (
        <div style={{
          position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: '#fff', border: '1px solid var(--border)',
          borderRadius: '20px', padding: '6px 14px', fontSize: '12px',
          color: 'var(--text-secondary)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#2db8b0', animation: 'pulse 1.2s infinite',
          }} />
          Loading map...
        </div>
      )}

      {/* Layer switcher */}
      <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1000 }}>
        <button
          onClick={() => setLayerMenuOpen(!layerMenuOpen)}
          style={{
            background: activeLayerId === 'dark' ? '#1e293b' : '#fff',
            color: activeLayerId === 'dark' ? '#e2e8f0' : '#1a2332',
            border: `1px solid ${activeLayerId === 'dark' ? '#334155' : '#e2e8f0'}`,
            borderRadius: '10px', padding: '8px 14px', fontSize: '13px',
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)', transition: 'all 0.2s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
          {activeLayer.label}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: layerMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {layerMenuOpen && (
          <div style={{
            position: 'absolute', top: '44px', right: '0',
            background: activeLayerId === 'dark' ? '#1e293b' : '#fff',
            border: `1px solid ${activeLayerId === 'dark' ? '#334155' : '#e2e8f0'}`,
            borderRadius: '10px', overflow: 'hidden', minWidth: '160px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}>
            {TILE_LAYERS.map((layer) => (
              <button
                key={layer.id}
                onClick={() => { setActiveLayerId(layer.id); setLayerMenuOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', padding: '10px 14px', border: 'none',
                  background: layer.id === activeLayerId
                    ? (activeLayerId === 'dark' ? '#334155' : '#f0fdfa')
                    : 'transparent',
                  color: activeLayerId === 'dark' ? '#e2e8f0' : '#1a2332',
                  fontSize: '13px', fontWeight: layer.id === activeLayerId ? 600 : 400,
                  cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                }}
                onMouseEnter={e => {
                  if (layer.id !== activeLayerId)
                    e.currentTarget.style.background = activeLayerId === 'dark' ? '#2d3a4d' : '#f8fafc'
                }}
                onMouseLeave={e => {
                  if (layer.id !== activeLayerId)
                    e.currentTarget.style.background = 'transparent'
                }}
              >
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: layer.polygonColor,
                  border: layer.id === activeLayerId ? `2px solid ${layer.polygonColor}` : '2px solid transparent',
                  boxShadow: layer.id === activeLayerId ? `0 0 0 2px ${activeLayerId === 'dark' ? '#1e293b' : '#fff'}, 0 0 0 4px ${layer.polygonColor}` : 'none',
                }} />
                {layer.label}
                {layer.id === activeLayerId && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={layer.polygonColor} strokeWidth="2.5" style={{ marginLeft: 'auto' }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <MapContainer
        center={FALLBACK_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
        zoomControl
      >
        <TileLayerSwitcher activeLayer={activeLayer} />

        {ready && <FlyToCenter center={center} />}

        {/* Region polygons */}
        {regions?.map(r => (
          <Polygon
            key={r.id}
            positions={r.polygon}
            pathOptions={{
              color: r.selected ? '#2db8b0' : activeLayer.polygonColor,
              fillColor: r.selected ? '#2db8b0' : activeLayer.polygonColor,
              fillOpacity: r.selected ? 0.35 : 0.12,
              weight: r.selected ? 3 : 1.5,
            }}
            eventHandlers={{
              click: () => onRegionClick?.(r.id),
            }}
          />
        ))}
      </MapContainer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
