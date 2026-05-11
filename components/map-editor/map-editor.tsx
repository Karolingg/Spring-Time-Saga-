'use client'

import { useMemo, useState } from 'react'
import { getDefaultMapImage, getMapImageById, MAP_CATALOG } from '@/src/features/map-editor/map-catalog'
import { loadMapIndex, loadMapLayout, saveMapLayout, buildNewMapLayout, type MapIndexEntry } from '@/src/features/map-editor/map-storage'
import type { MapLayout } from '@/src/features/map-editor/map-types'
import { useMapEditor } from '@/src/features/map-editor/use-map-editor'
import { useMapSimulation } from '@/src/features/map-editor/use-map-simulation'
import { MapEditorCanvas } from './map-editor-canvas'
import { MapEditorSidebar } from './map-editor-sidebar'
import { MapEditorToolbar } from './map-editor-toolbar'

function buildInitialMap(): MapLayout {
  const image = getDefaultMapImage()
  const now = new Date().toISOString()
  return {
    id: 'draft',
    name: 'Untitled Map',
    image,
    zones: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function MapEditor() {
  const [savedMaps, setSavedMaps] = useState<MapIndexEntry[]>(loadMapIndex())
  const editor = useMapEditor(buildInitialMap())
  const simulation = useMapSimulation(editor.mapLayout)

  const isDraft = editor.mapLayout.id === 'draft'
  const activeMapLabel = isDraft ? 'Draft' : editor.mapLayout.name

  const mapList = useMemo(() => {
    return savedMaps.map((entry) => ({ ...entry, label: entry.name }))
  }, [savedMaps])

  const handleSelectSavedMap = (mapId: string) => {
    const loaded = loadMapLayout(mapId)
    if (!loaded) return
    editor.replaceMapLayout(loaded)
  }

  const handleSave = () => {
    const updated = isDraft
      ? buildNewMapLayout({
        name: editor.mapLayout.name,
        image: editor.mapLayout.image,
        zones: editor.mapLayout.zones,
      })
      : { ...editor.mapLayout, updatedAt: new Date().toISOString() }
    saveMapLayout(updated)
    setSavedMaps(loadMapIndex())
    editor.replaceMapLayout(updated)
  }

  const handleLoadImage = (imageId: string) => {
    const image = getMapImageById(imageId)
    if (!image) return
    editor.setImage(image)
  }

  return (
    <div className="map-editor">
      <div className="map-editor__layout">
        <MapEditorSidebar
          mapLayout={editor.mapLayout}
          mapCatalog={MAP_CATALOG}
          mapList={mapList}
          activeMapLabel={activeMapLabel}
          selectedZoneId={editor.selectedZoneId}
          onImageChange={handleLoadImage}
          onMapNameChange={editor.setMapName}
          onZoneDelete={editor.deleteZone}
          onZoneRename={editor.renameZone}
          onSelectZone={editor.setSelectedZoneId}
          onSave={handleSave}
          onSelectSavedMap={handleSelectSavedMap}
          onZoneUpdate={editor.updateZone}
          simulationState={simulation.simulationState}
        />

        <div>
          <MapEditorToolbar
            tool={editor.tool}
            zoneType={editor.zoneType}
            isRunning={simulation.isRunning}
            onToolChange={editor.setTool}
            onZoneTypeChange={editor.setZoneType}
            onStartSimulation={simulation.startSimulation}
            onStopSimulation={simulation.stopSimulation}
            onResetSimulation={simulation.resetSimulation}
          />

          <div className="map-editor__panel">
            <MapEditorCanvas
              mapLayout={editor.mapLayout}
              viewBox={editor.viewBox}
              tool={editor.tool}
              zoneType={editor.zoneType}
              selectedZoneId={editor.selectedZoneId}
              draftRect={editor.draftPreview}
              draftPolygon={editor.draftPolygon}
              simulationState={simulation.simulationState}
              onSelectZone={editor.selectZoneByPoint}
              onMoveZone={editor.moveSelectedZone}
              onMoveVertex={editor.moveSelectedVertex}
              onDraftRect={editor.setDraftFromPoints}
              onCommitRect={editor.commitDraftRect}
              onAddPolygonPoint={editor.addDraftPoint}
              onCommitPolygon={editor.commitDraftPolygon}
              onCancelDraft={editor.cancelDraft}
              onPan={editor.updateViewBox}
              onZoom={editor.zoomToPoint}
            />
            <div className="map-editor__footer">
              Agents per floor: 360 max. Draw spawn, hallway, and exit zones to start.
            </div>
          </div>
        </div>

        <div className="map-editor__panel">
          <div className="map-editor__panel-title">Active Map</div>
          <div className="map-editor__stat-row">
            <span>Name</span>
            <span>{activeMapLabel}</span>
          </div>
          <div className="map-editor__stat-row">
            <span>Zones</span>
            <span>{editor.mapLayout.zones.length}</span>
          </div>
          <div className="map-editor__stat-row">
            <span>Running</span>
            <span>{simulation.isRunning ? 'Yes' : 'No'}</span>
          </div>
          <div className="map-editor__stat-row">
            <span>Exited</span>
            <span>{simulation.simulationState?.exitedCount ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
