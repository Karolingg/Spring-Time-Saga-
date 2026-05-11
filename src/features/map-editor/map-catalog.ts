import type { MapImage } from './map-types'

const DEFAULT_WIDTH = 1200
const DEFAULT_HEIGHT = 675

export const MAP_CATALOG: MapImage[] = [
  { id: 'admin-1f', name: 'Admin 1st Floor', src: '/floorplans/Admin%201st%20floor.svg', width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
  { id: 'admin-2f', name: 'Admin 2nd Floor', src: '/floorplans/Admin%202nd%20floor.svg', width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
  { id: 'asx-1f', name: 'ASX 1st Floor', src: '/floorplans/ASX%201st%20floor.svg', width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
  { id: 'csb-1f', name: 'CSB 1st Floor', src: '/floorplans/CSB%201st%20floor.svg', width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
  { id: 'csb-2f', name: 'CSB 2nd Floor', src: '/floorplans/CSB%202nd%20floor.svg', width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
  { id: 'csb-3f', name: 'CSB 3rd Floor', src: '/floorplans/CSB%203rd%20floor.svg', width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
  { id: 'csb-4f', name: 'CSB 4th Floor', src: '/floorplans/CSB%204th%20floor.svg', width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
  { id: 'csb-5f', name: 'CSB 5th Floor', src: '/floorplans/CSB%205th%20floor.svg', width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
  { id: 'csb-6f', name: 'CSB 6th Floor', src: '/floorplans/CSB%206th%20floor.svg', width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
  { id: 'library-1f', name: 'Library 1st Floor', src: '/floorplans/Library%201st%20floor.svg', width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
  { id: 'library-2f', name: 'Library 2nd Floor', src: '/floorplans/Library%202nd%20floor.svg', width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
]

export function getMapImageById(imageId: string): MapImage | null {
  return MAP_CATALOG.find((image) => image.id === imageId) ?? null
}

export function getDefaultMapImage(): MapImage {
  return MAP_CATALOG[0]
}
