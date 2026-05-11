import type { MapImage, MapLayout } from '@/src/features/map-editor/map-types'
import type { MapIndexEntry } from '@/src/features/map-editor/map-storage'
import type { SimulationState } from '@/src/features/map-editor/simulation-types'
import { getZonePoints } from '@/src/features/map-editor/zone-utils'

interface MapEditorSidebarProps {
  mapLayout: MapLayout
  mapCatalog: MapImage[]
  mapList: Array<MapIndexEntry & { label: string }>
  activeMapLabel: string
  selectedZoneId: string | null
  simulationState: SimulationState | null
  onImageChange: (imageId: string) => void
  onMapNameChange: (name: string) => void
  onSave: () => void
  onSelectSavedMap: (mapId: string) => void
  onSelectZone: (zoneId: string | null) => void
  onZoneRename: (zoneId: string, name: string) => void
  onZoneUpdate: (zone: MapLayout['zones'][number]) => void
  onZoneDelete: (zoneId: string) => void
}

export function MapEditorSidebar({
  mapLayout,
  mapCatalog,
  mapList,
  activeMapLabel,
  selectedZoneId,
  simulationState,
  onImageChange,
  onMapNameChange,
  onSave,
  onSelectSavedMap,
  onSelectZone,
  onZoneRename,
  onZoneUpdate,
  onZoneDelete,
}: MapEditorSidebarProps) {
  return (
    <aside className="map-editor__panel">
      <div className="map-editor__section">
        <div className="map-editor__panel-title">Map Setup</div>
        <label className="map-editor__label" htmlFor="map-name">
          Map name
        </label>
        <input
          id="map-name"
          className="map-editor__input"
          value={mapLayout.name}
          onChange={(event) => onMapNameChange(event.target.value)}
        />
      </div>

      <div className="map-editor__section">
        <label className="map-editor__label" htmlFor="map-image">
          Floor plan image
        </label>
        <select
          id="map-image"
          className="map-editor__select"
          value={mapLayout.image.id}
          onChange={(event) => onImageChange(event.target.value)}
        >
          {mapCatalog.map((image) => (
            <option key={image.id} value={image.id}>
              {image.name}
            </option>
          ))}
        </select>
      </div>

      <div className="map-editor__section">
        <div className="map-editor__panel-title">Saved Maps</div>
        <select
          className="map-editor__select"
          onChange={(event) => onSelectSavedMap(event.target.value)}
        >
          <option value="">Select saved map</option>
          {mapList.map((map) => (
            <option key={map.id} value={map.id}>
              {map.label}
            </option>
          ))}
        </select>
        <button className="map-editor__button map-editor__button--primary" onClick={onSave}>
          Save Map
        </button>
        <div className="map-editor__muted">Active: {activeMapLabel}</div>
      </div>

      <div className="map-editor__section">
        <div className="map-editor__panel-title">Zones</div>
        <div className="map-editor__zone-list">
          {mapLayout.zones.map((zone) => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              selected={zone.id === selectedZoneId}
              onSelect={() => onSelectZone(zone.id)}
              onRename={onZoneRename}
              onUpdate={onZoneUpdate}
              onDelete={onZoneDelete}
            />
          ))}
          {mapLayout.zones.length === 0 && (
            <div className="map-editor__muted">No zones yet. Draw to start.</div>
          )}
        </div>
      </div>

      <div className="map-editor__section">
        <div className="map-editor__panel-title">Simulation</div>
        <div className="map-editor__stat-row">
          <span>Agents</span>
          <span>{simulationState?.agents.length ?? 0}</span>
        </div>
        <div className="map-editor__stat-row">
          <span>Exited</span>
          <span>{simulationState?.exitedCount ?? 0}</span>
        </div>
      </div>
    </aside>
  )
}

interface ZoneCardProps {
  zone: MapLayout['zones'][number]
  selected: boolean
  onSelect: () => void
  onRename: (zoneId: string, name: string) => void
  onUpdate: (zone: MapLayout['zones'][number]) => void
  onDelete: (zoneId: string) => void
}

function ZoneCard({ zone, selected, onSelect, onRename, onUpdate, onDelete }: ZoneCardProps) {
  const className = selected ? 'map-editor__zone-card map-editor__zone-card--selected' : 'map-editor__zone-card'
  const points = getZonePoints(zone)
  const label = `${zone.type} · ${points.length} pts`

  return (
    <div className={className} onClick={onSelect}>
      <div className="map-editor__zone-row">
        <div>
          <div className="map-editor__zone-type">{label}</div>
          <input
            className="map-editor__input"
            value={zone.name}
            onChange={(event) => onRename(zone.id, event.target.value)}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
        <button
          className="map-editor__button map-editor__button--danger"
          onClick={(event) => {
            event.stopPropagation()
            onDelete(zone.id)
          }}
        >
          Delete
        </button>
      </div>
      {zone.type === 'spawn' && (
        <div className="map-editor__section">
          <label className="map-editor__label">Spawn Count</label>
          <input
            className="map-editor__input"
            type="number"
            min={0}
            value={zone.spawnCount ?? 40}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              const next = Number(event.target.value)
              onUpdate({ ...zone, spawnCount: Number.isNaN(next) ? 0 : next })
            }}
          />
          <label className="map-editor__label">Max Agents</label>
          <input
            className="map-editor__input"
            type="number"
            min={0}
            value={zone.maxAgents ?? 60}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              const next = Number(event.target.value)
              onUpdate({ ...zone, maxAgents: Number.isNaN(next) ? 0 : next })
            }}
          />
        </div>
      )}
    </div>
  )
}
