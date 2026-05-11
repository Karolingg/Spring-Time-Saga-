import type { EditorTool, ZoneType } from '@/src/features/map-editor/map-types'

interface MapEditorToolbarProps {
  tool: EditorTool
  zoneType: ZoneType
  isRunning: boolean
  onToolChange: (tool: EditorTool) => void
  onZoneTypeChange: (zoneType: ZoneType) => void
  onStartSimulation: () => void
  onStopSimulation: () => void
  onResetSimulation: () => void
}

export function MapEditorToolbar({
  tool,
  zoneType,
  isRunning,
  onToolChange,
  onZoneTypeChange,
  onStartSimulation,
  onStopSimulation,
  onResetSimulation,
}: MapEditorToolbarProps) {
  return (
    <div className="map-editor__panel map-editor__section">
      <div className="map-editor__panel-title">Editor Tools</div>
      <div className="map-editor__toolbar">
        {buildToolButtons(tool, onToolChange)}
      </div>
      <div className="map-editor__toolbar">
        {buildZoneButtons(zoneType, onZoneTypeChange)}
      </div>
      <div className="map-editor__toolbar">
        <button className="map-editor__button map-editor__button--primary" onClick={onStartSimulation} disabled={isRunning}>
          Start Simulation
        </button>
        <button className="map-editor__button" onClick={onStopSimulation} disabled={!isRunning}>
          Pause
        </button>
        <button className="map-editor__button" onClick={onResetSimulation}>
          Reset
        </button>
      </div>
    </div>
  )
}

function buildToolButtons(activeTool: EditorTool, onChange: (tool: EditorTool) => void) {
  const items: Array<{ id: EditorTool; label: string }> = [
    { id: 'select', label: 'Select' },
    { id: 'rect', label: 'Rect' },
    { id: 'polygon', label: 'Polygon' },
    { id: 'pan', label: 'Pan' },
  ]
  return items.map((item) => (
    <button
      key={item.id}
      className={getToolClass(activeTool === item.id)}
      onClick={() => onChange(item.id)}
    >
      {item.label}
    </button>
  ))
}

function buildZoneButtons(activeType: ZoneType, onChange: (zoneType: ZoneType) => void) {
  const items: Array<{ id: ZoneType; label: string }> = [
    { id: 'spawn', label: 'Spawn' },
    { id: 'walkable', label: 'Hallway' },
    { id: 'exit', label: 'Exit' },
  ]
  return items.map((item) => (
    <button
      key={item.id}
      className={getToolClass(activeType === item.id)}
      onClick={() => onChange(item.id)}
    >
      {item.label}
    </button>
  ))
}

function getToolClass(isActive: boolean): string {
  return isActive ? 'map-editor__tool-button map-editor__tool-button--active' : 'map-editor__tool-button'
}
