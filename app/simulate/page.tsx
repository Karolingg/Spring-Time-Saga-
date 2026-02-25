'use client'

import { useEffect } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import { GridBackground } from '@/components/GridBackground'
import { BlinkingCursor } from '@/components/Cursor'
import '@/styles/stub-page.css'

export default function SimulatePage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      window.location.href = '/auth'
    }
  }, [isAuthLoading, isAuthenticated])

  if (isAuthLoading) {
    return (
      <div className="stub-page__loading">
        <div className="stub-page__loading-text">LOADING...</div>
      </div>
    )
  }

  const params = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : null
  const disasterType = params?.get('disaster') ?? 'fire'
  const isFireMode = disasterType === 'fire'

  const accentColor = isFireMode ? '#ff6b35' : '#f59e0b'
  const icon = isFireMode ? '🔥' : '🌎'
  const label = isFireMode ? 'Fire Simulation' : 'Earthquake Simulation'

  return (
    <div className="stub-page">
      <GridBackground />

      <div className="stub-page__container">
        <div className="stub-page__label">
          <div className="stub-page__label-line" style={{ background: accentColor }} />
          <span className="stub-page__label-text" style={{ color: accentColor }}>
            Simulation Engine
          </span>
        </div>

        <h1 className="stub-page__title">
          <span className="stub-page__icon">{icon}</span>
          {' '}
          <span style={{ color: accentColor }}>{label.toUpperCase()}</span>
          <BlinkingCursor />
        </h1>

        <p className="stub-page__description">
          This page will host the agent-based evacuation simulation powered by
          PixiJS rendering and Leaflet mapping. The simulation engine, agent
          controls, and real-time visualization will be built here.
        </p>

        <div className="stub-page__status">
          <div className="stub-page__status-indicator" style={{ background: accentColor }} />
          <span className="stub-page__status-text">MODULE PENDING IMPLEMENTATION</span>
        </div>
      </div>
    </div>
  )
}
