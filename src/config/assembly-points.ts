/**
 * Campus evacuation assembly areas.
 *
 * Designated muster points where occupants gather after exiting a building.
 * Used by the campus map to:
 *   - Render distinct assembly markers (separate from building markers)
 *   - Tell each building which assembly point to direct its occupants to
 *
 * IMPORTANT — verify coordinates with UP Cebu facilities before deploying.
 * The positions below are PROTOTYPE placements at plausible open areas on
 * the campus; the real designated assembly points should be confirmed and
 * substituted here.
 */

export interface AssemblyPoint {
  id: string
  name: string
  description: string
  /** [lat, lng] */
  position: [number, number]
  /** Rough head-count this area can safely hold. */
  capacity: number
  /** Path to assembly area image */
  image?: string
}

export const ASSEMBLY_POINTS: AssemblyPoint[] = [
  {
    id: 'central-quadrangle',
    name: 'Admin Field ',
    description: 'Open lawn between the academic buildings — primary muster point for the west campus.',
    position: [10.3215, 123.8985  ],
    capacity: 800,
    image: '/assembly-areas/central-quadrangle.jpg',
  },
  {
    id: 'east-plaza',
    name: 'Soccer Field',
    description: 'Hard-surface open area east of the AS Wings.',
    position: [10.3227, 123.8999],
    capacity: 500,
    image: '/assembly-areas/east-plaza.jpg',
  },
  {
    id: 'high-school-field',
    name: 'High School Field',
    description: 'Open field east of the High School building.',
    position: [10.3215, 123.9030],
    capacity: 600,
    image: '/assembly-areas/high-school-field.jpg',
  },
]

/** Haversine distance in metres between two [lat, lng] points. */
export function distanceMeters(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const [lat1, lng1] = a
  const [lat2, lng2] = b
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const aa = sinLat * sinLat + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLng * sinLng
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
}

/** Nearest assembly point to a [lat, lng] coordinate, plus the distance. */
export function getNearestAssembly(
  position: [number, number],
): { point: AssemblyPoint; distance: number } | null {
  if (ASSEMBLY_POINTS.length === 0) return null
  let best: AssemblyPoint | null = null
  let bestDist = Infinity
  for (const p of ASSEMBLY_POINTS) {
    const d = distanceMeters(position, p.position)
    if (d < bestDist) {
      bestDist = d
      best = p
    }
  }
  return best ? { point: best, distance: bestDist } : null
}
