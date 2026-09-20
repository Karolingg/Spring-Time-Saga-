/**
 * Compact relative-time label, e.g. "just now", "12m ago", "5d ago". Past a
 * month the elapsed count stops being useful, so it falls back to the date.
 */
export function relativeTime(dateStr: string): string {
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return new Date(dateStr).toLocaleDateString()
}

/**
 * Plain-language label for a nav-graph zone name. Zone names come from the
 * authored floor graphs ("Out 606", "Door Room 602"), which read as internal
 * plumbing — this names the kind of place a facility manager would recognise.
 */
export function friendlyZoneType(zoneName: string): string {
  const n = zoneName.toLowerCase()
  if (n.includes('corridor') || n.includes('hallway')) return 'Corridor'
  if (n.includes('stair'))    return 'Stairwell'
  if (n.includes('exit') || n.includes('out ') || n.startsWith('out')) return 'Exit area'
  if (n.includes('door'))     return 'Doorway'
  if (n.includes('room'))     return 'Room entrance'
  if (n.includes('toilet') || n.includes('restroom')) return 'Restroom area'
  if (n.includes('waypoint')) return 'Passage'
  return 'Zone'
}
