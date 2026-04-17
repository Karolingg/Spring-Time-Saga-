'use client'

import { useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/src/hooks/useAuth'

const DISASTER_META: Record<string, { label: string; color: string; iconPath: React.ReactNode }> = {
  fire: {
    label: 'Fire Simulation',
    color: '#ff6b35',
    iconPath: (
      <>
        <path d="M12 2c.5 2.5 2 4.5 2 7a4 4 0 1 1-8 0c0-2.5 2-4.5 2-7 1.5 1.5 2.5 3 4 0z" />
        <path d="M12 12c.5 1 1 2 1 3a2 2 0 1 1-4 0c0-1 .5-2 1-3 .5.5 1 1 2 0z" />
      </>
    ),
  },
  earthquake: {
    label: 'Earthquake Simulation',
    color: '#f59e0b',
    iconPath: (
      <>
        <path d="M2 12h4l2-5 3 10 3-10 2 5h4" />
      </>
    ),
  },
}

export default function SimulationRunPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const regionId = params.id as string
  const disaster = searchParams.get('disaster') || 'fire'

  useEffect(() => {
    if (!isLoading && !isAuthenticated) window.location.href = '/auth'
  }, [isLoading, isAuthenticated])

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>
      </div>
    )
  }

  const displayName = regionId
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  const meta = DISASTER_META[disaster] || DISASTER_META.fire

  return (
    <div style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* Back button */}
      <button
        onClick={() => router.push(`/simulate/${encodeURIComponent(regionId)}/disaster`)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', color: 'var(--text-secondary)',
          fontSize: '13px', cursor: 'pointer', padding: '0', marginBottom: '28px',
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Change disaster type
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '14px',
          background: `${meta.color}12`,
          border: `1px solid ${meta.color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {meta.iconPath}
          </svg>
        </div>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {meta.label}
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Region: <span style={{ color: '#2db8b0', fontWeight: 600 }}>{displayName}</span>
          </p>
        </div>
      </div>

      {/* Placeholder map area */}
      <div style={{
        position: 'relative',
        background: 'var(--card-bg, #1e293b)',
        border: '1px solid var(--border, #334155)',
        borderRadius: '16px',
        height: '560px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '20px',
        overflow: 'hidden',
      }}>
        {/* Subtle grid pattern background */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.03,
          backgroundImage: `linear-gradient(${meta.color} 1px, transparent 1px), linear-gradient(90deg, ${meta.color} 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          pointerEvents: 'none',
        }} />

        <div style={{
          width: '64px', height: '64px', borderRadius: '18px',
          background: `${meta.color}10`,
          border: `1px solid ${meta.color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /><path d="M15 3v18" />
          </svg>
        </div>

        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
            Simulation Map
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '340px', lineHeight: 1.6 }}>
            The interactive simulation for{' '}
            <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label.toLowerCase()}</span>{' '}
            in <span style={{ fontWeight: 600 }}>{displayName}</span> will render here.
          </div>
        </div>

        <div style={{
          marginTop: '4px', padding: '8px 18px',
          background: `${meta.color}0a`,
          border: `1px solid ${meta.color}20`,
          borderRadius: '10px',
          fontSize: '12px', color: meta.color, fontWeight: 600,
          letterSpacing: '0.04em', textTransform: 'uppercase',
          position: 'relative',
        }}>
          Coming soon
        </div>
      </div>
    </div>
  )
}
