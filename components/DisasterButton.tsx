import { useEffect, useState } from 'react'
import '@/styles/components.css'

interface DisasterButtonProps {
  type: string
  icon: string
  label: string
  description: string
  color: string
  href: string
  delay: number
}

export function DisasterButton({
  icon,
  label,
  description,
  color,
  href,
  delay,
}: DisasterButtonProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  return (
    <a href={href} className={`disaster-button ${visible ? 'visible' : ''}`}>
      <div className="disaster-button-card" style={{ borderColor: color }}>
        <div className="disaster-button-corner-tr" style={{ borderColor: color }} />
        <div className="disaster-button-corner-bl" style={{ borderColor: color }} />

        <div className="disaster-button-icon">{icon}</div>
        <h3 className="disaster-button-title" style={{ color }}>
          {label}
        </h3>
        <p className="disaster-button-description">{description}</p>

        <div className="disaster-button-cta">
          <div className="disaster-button-cta-line" style={{ background: color }} />
          <span className="disaster-button-cta-text" style={{ color }}>
            RUN SIMULATION
          </span>
        </div>
      </div>
    </a>
  )
}
