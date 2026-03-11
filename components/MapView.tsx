'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Polygon, Popup, useMap } from 'react-leaflet'
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

const UNIVERSITY_NAME = 'UP High School – Cebu'
const FALLBACK_CENTER: [number, number] = [10.3311, 123.9009]
const DEFAULT_ZOOM = 18

type LatLng = [number, number]

function FlyToCenter({ center }: { center: LatLng }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, DEFAULT_ZOOM, { duration: 1.2 })
  }, [center, map])
  return null
}

export default function MapView() {
  const [polygonCoords, setPolygonCoords] = useState<LatLng[]>([])
  const [center, setCenter] = useState<LatLng>(FALLBACK_CENTER)
  const [loadState, setLoadState] = useState<'loading' | 'success' | 'error'>('loading')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Small delay so MapContainer mounts before we try to flyTo
    const t = setTimeout(() => setReady(true), 300)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    // Use Nominatim to search by name + location, then fetch the building polygon
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
        const geo = result.geojson

        let coords: LatLng[] = []

        if (geo?.type === 'Polygon' && geo.coordinates?.[0]) {
          // GeoJSON is [lng, lat] — flip to [lat, lng] for Leaflet
          coords = geo.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng] as LatLng)
        } else if (geo?.type === 'Point') {
          // Point only — use as center, no polygon
          coords = []
          setCenter([parseFloat(result.lat), parseFloat(result.lon)])
          setLoadState('success')
          return
        }

        if (coords.length > 0) {
          setPolygonCoords(coords)
          setCenter([parseFloat(result.lat), parseFloat(result.lon)])
          setLoadState('success')
        } else {
          // Fallback: at least centre on the result
          setCenter([parseFloat(result.lat), parseFloat(result.lon)])
          setLoadState('success')
        }
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
          Fetching building from OpenStreetMap...
        </div>
      )}
      {loadState === 'error' && (
        <div style={{
          position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: '#fff', border: '1px solid #fecaca',
          borderRadius: '20px', padding: '6px 14px', fontSize: '12px',
          color: '#dc2626', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          Could not load building outline — showing approximate location
        </div>
      )}

      <MapContainer
        center={FALLBACK_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
        zoomControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />

        {ready && polygonCoords.length > 0 && (
          <FlyToCenter center={center} />
        )}

        {polygonCoords.length > 0 && (
          <Polygon
            positions={polygonCoords}
            pathOptions={{
              color: '#2db8b0',
              weight: 2.5,
              fillColor: '#2db8b0',
              fillOpacity: 0.2,
            }}
          >
            <Popup>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a2332' }}>
                {UNIVERSITY_NAME}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Lahug, Cebu City, Philippines
              </div>
            </Popup>
          </Polygon>
        )}
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
