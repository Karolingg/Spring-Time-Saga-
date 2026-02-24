import { useEffect, useState } from 'react'
import '@/styles/components.css'

interface StatCardProps {
  label: string
  value: string
  unit: string
  color: string
  delay: number
}

export function StatCard({ label, value, unit, color, delay }: StatCardProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  return (
    <div className={`stat-card ${visible ? 'visible' : ''}`} style={{ borderColor: `${color}22` }}>
      <div className="stat-card-accent" style={{ background: color }} />
      <p className="stat-card-label">{label}</p>
      <div className="stat-card-value">
        <span className="stat-card-number" style={{ color }}>
          {value}
        </span>
        <span className="stat-card-unit">{unit}</span>
      </div>
    </div>
  )
}
