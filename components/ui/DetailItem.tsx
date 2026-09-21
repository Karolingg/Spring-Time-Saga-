interface DetailItemProps {
  label: string
  value: string
  /** Overrides the value colour — used to carry a risk/status tone. */
  color?: string
}

/** Small uppercase label above a value. Used in the expanded zone rows. */
export function DetailItem({ label, value, color }: DetailItemProps) {
  return (
    <div>
      <div style={{
        fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)',
        letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '2px',
      }}>
        {label}
      </div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: color ?? 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  )
}
