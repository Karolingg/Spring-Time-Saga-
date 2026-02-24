'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import { GridBackground } from '@/components/GridBackground'
import { StatCard } from '@/components/StatCard'
import { DisasterButton } from '@/components/DisasterButton'
import { BlinkingCursor } from '@/components/Cursor'
import '@/styles/dashboard.css'

export default function DashboardPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const [loaded, setLoaded] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(false)

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      window.location.href = '/auth'
    }
  }, [isAuthLoading, isAuthenticated])

  useEffect(() => {
    const t1 = setTimeout(() => setLoaded(true), 100)
    const t2 = setTimeout(() => setHeaderVisible(true), 300)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  if (isAuthLoading) {
    return (
      <div className="loading-container">
        <div className="loading-text">AUTHENTICATING...</div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <GridBackground />

      {/* Top Status Bar */}
      <div className={`status-bar ${loaded ? 'loaded' : ''}`}>
        <div className="status-bar-left">
          <div className="status-indicator" />
          <span className="status-label">EVAC-SIM v1.0</span>
        </div>
        <div className="status-bar-right">
          <span className="status-item">SYSTEM READY</span>
          <span className="status-item">DB CONNECTED</span>
          <span className="status-item">ENGINE IDLE</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-container">
        {/* System Label */}
        <div className={`section-label ${headerVisible ? 'visible' : ''}`}>
          <div className="section-line" />
          <span className="section-text">Crowd Evacuation Analysis Platform</span>
        </div>

        {/* Main Title */}
        <div className={`header ${headerVisible ? 'visible' : ''}`}>
          <h1 className="header-title">
            EVACUATION
            <br />
            <span className="header-highlight">SIMULATOR</span>
            <BlinkingCursor />
          </h1>
        </div>

        {/* Subtitle */}
        <p className={`subtitle ${headerVisible ? 'visible' : ''}`}>
          Agent-based crowd simulation with predictive congestion analysis.
          Model disaster scenarios across multi-floor university buildings.
        </p>

        {/* Stats Grid */}
        <div className="stats-grid">
          <StatCard label="Simulation Engine" value="ABS" unit="agent-based" color="#00ffb4" delay={600} />
          <StatCard label="Max Agent Load" value="500" unit="agents" color="#00ffb4" delay={750} />
          <StatCard label="Disaster Modes" value="02" unit="scenarios" color="#ff6b35" delay={900} />
          <StatCard label="Data Backend" value="PG" unit="supabase" color="#00ffb4" delay={1050} />
        </div>

        {/* Divider */}
        <div className={`divider ${loaded ? 'loaded' : ''}`}>
          <span className="divider-label">Select Mode</span>
          <div className="divider-line" />
        </div>

        {/* Action Buttons */}
        <div className="actions-grid">
          <DisasterButton
            type="fire"
            icon="🔥"
            label="Fire Scenario"
            description="High urgency, competitive exit behavior. Rapid bottleneck formation with elevated agent speed."
            color="#ff6b35"
            href="/simulate?disaster=fire"
            delay={1000}
          />
          <DisasterButton
            type="earthquake"
            icon="🌎"
            label="Earthquake Scenario"
            description="Slower movement, dynamic obstacles, structural uncertainty. Gradual congestion buildup."
            color="#f59e0b"
            href="/simulate?disaster=earthquake"
            delay={1150}
          />
          <DisasterButton
            type="analysis"
            icon="📊"
            label="Congestion Analysis"
            description="Aggregate historical simulation data. Identify chronic bottlenecks and campus risk zones."
            color="#00ffb4"
            href="/analysis"
            delay={1300}
          />
        </div>

        {/* Footer Info */}
        <div className={`footer-strip ${loaded ? 'loaded' : ''}`}>
          <div className="footer-left">
            {[
              { label: 'Rendering', value: 'PixiJS' },
              { label: 'Map', value: 'Leaflet + CartoDB' },
              { label: 'Storage', value: 'Supabase' },
            ].map((item, i) => (
              <div key={i}>
                <p className="footer-item-label">{item.label}</p>
                <p className="footer-item-value">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="footer-right">Software Engineering Project © 2025</div>
        </div>
      </div>
    </div>
  )
}
