'use client'

import { useEffect } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import { GridBackground } from '@/components/GridBackground'
import { BlinkingCursor } from '@/components/Cursor'
import '@/styles/stub-page.css'

export default function AnalysisPage() {
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

  return (
    <div className="stub-page">
      <GridBackground />

      <div className="stub-page__container">
        <div className="stub-page__label">
          <div className="stub-page__label-line" />
          <span className="stub-page__label-text">Data Analytics</span>
        </div>

        <h1 className="stub-page__title">
          <span className="stub-page__icon">📊</span>
          {' '}
          <span className="stub-page__title-accent">CONGESTION ANALYSIS</span>
          <BlinkingCursor />
        </h1>

        <p className="stub-page__description">
          This page will display heatmaps and aggregate historical simulation
          data. Identify chronic bottlenecks and campus risk zones through
          interactive visualizations powered by D3.js.
        </p>

        <div className="stub-page__status">
          <div className="stub-page__status-indicator" />
          <span className="stub-page__status-text">MODULE PENDING IMPLEMENTATION</span>
        </div>
      </div>
    </div>
  )
}
