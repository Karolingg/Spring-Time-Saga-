'use client'

import { useEffect, useRef, useState } from 'react'

// Animated grid background
function GridBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden">
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0, 255, 180, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 180, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />
      {/* Radial glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '800px',
          height: '800px',
          background: 'radial-gradient(circle, rgba(0,255,160,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      {/* Bottom red glow for danger indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: '-100px',
          right: '10%',
          width: '600px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(255,60,60,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

// Stat card component
function StatCard({
  label,
  value,
  unit,
  color,
  delay,
}: {
  label: string
  value: string
  unit: string
  color: string
  delay: number
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${color}22`,
        borderRadius: '2px',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top accent line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: color,
        }}
      />
      <p style={{ color: '#666', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '12px', fontFamily: 'monospace' }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{ fontSize: '36px', fontWeight: '700', color: color, fontFamily: 'monospace', letterSpacing: '-0.02em' }}>
          {value}
        </span>
        <span style={{ fontSize: '12px', color: '#555', fontFamily: 'monospace' }}>{unit}</span>
      </div>
    </div>
  )
}

// Disaster mode button
function DisasterButton({
  type,
  icon,
  label,
  description,
  color,
  href,
  delay,
}: {
  type: string
  icon: string
  label: string
  description: string
  color: string
  href: string
  delay: number
}) {
  const [hovered, setHovered] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
        textDecoration: 'none',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          background: hovered ? `${color}10` : 'rgba(255,255,255,0.015)',
          border: `1px solid ${hovered ? color : color + '33'}`,
          borderRadius: '2px',
          padding: '32px',
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Animated corner bracket */}
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          width: '16px',
          height: '16px',
          borderTop: `2px solid ${color}`,
          borderRight: `2px solid ${color}`,
          opacity: hovered ? 1 : 0.3,
          transition: 'opacity 0.3s ease',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          width: '16px',
          height: '16px',
          borderBottom: `2px solid ${color}`,
          borderLeft: `2px solid ${color}`,
          opacity: hovered ? 1 : 0.3,
          transition: 'opacity 0.3s ease',
        }} />

        <div style={{ fontSize: '32px', marginBottom: '16px' }}>{icon}</div>
        <h3 style={{
          fontFamily: 'monospace',
          fontSize: '13px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: color,
          marginBottom: '8px',
          fontWeight: '700',
        }}>
          {label}
        </h3>
        <p style={{
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#555',
          lineHeight: '1.6',
          letterSpacing: '0.05em',
        }}>
          {description}
        </p>

        <div style={{
          marginTop: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          opacity: hovered ? 1 : 0.4,
          transition: 'opacity 0.3s ease',
        }}>
          <div style={{ width: '20px', height: '1px', background: color }} />
          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: color, letterSpacing: '0.15em' }}>
            RUN SIMULATION
          </span>
        </div>
      </div>
    </a>
  )
}

// Blinking cursor
function Cursor() {
  const [on, setOn] = useState(true)
  useEffect(() => {
    const t = setInterval(() => setOn(v => !v), 530)
    return () => clearInterval(t)
  }, [])
  return (
    <span style={{
      display: 'inline-block',
      width: '2px',
      height: '1em',
      background: '#00ffb4',
      marginLeft: '4px',
      verticalAlign: 'middle',
      opacity: on ? 1 : 0,
      transition: 'opacity 0.1s',
    }} />
  )
}

export default function DashboardPage() {
  const [loaded, setLoaded] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setLoaded(true), 100)
    const t2 = setTimeout(() => setHeaderVisible(true), 300)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080808',
      color: '#e0e0e0',
      fontFamily: 'monospace',
      position: 'relative',
    }}>
      <GridBackground />

      {/* Top status bar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '40px',
        borderBottom: '1px solid rgba(0,255,180,0.08)',
        background: 'rgba(8,8,8,0.9)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        zIndex: 100,
        opacity: loaded ? 1 : 0,
        transition: 'opacity 0.5s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff9d', boxShadow: '0 0 8px #00ff9d' }} />
          <span style={{ fontSize: '10px', letterSpacing: '0.2em', color: '#444', textTransform: 'uppercase' }}>
            EVAC-SIM v1.0
          </span>
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          {['SYSTEM READY', 'DB CONNECTED', 'ENGINE IDLE'].map((s, i) => (
            <span key={i} style={{ fontSize: '9px', letterSpacing: '0.15em', color: '#333', textTransform: 'uppercase' }}>
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '120px 32px 80px',
      }}>

        {/* System label */}
        <div style={{
          opacity: headerVisible ? 1 : 0,
          transform: headerVisible ? 'translateY(0)' : 'translateY(-10px)',
          transition: 'all 0.5s ease',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{ width: '32px', height: '1px', background: '#00ffb4' }} />
          <span style={{ fontSize: '10px', letterSpacing: '0.3em', color: '#00ffb4', textTransform: 'uppercase' }}>
            Crowd Evacuation Analysis Platform
          </span>
        </div>

        {/* Main title */}
        <div style={{
          opacity: headerVisible ? 1 : 0,
          transform: headerVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.7s ease 0.1s',
          marginBottom: '16px',
        }}>
          <h1 style={{
            fontSize: 'clamp(40px, 6vw, 72px)',
            fontWeight: '800',
            lineHeight: '1.0',
            letterSpacing: '-0.03em',
            color: '#f0f0f0',
            fontFamily: 'monospace',
          }}>
            EVACUATION
            <br />
            <span style={{ color: '#00ffb4' }}>SIMULATOR</span>
            <Cursor />
          </h1>
        </div>

        {/* Subtitle */}
        <p style={{
          opacity: headerVisible ? 1 : 0,
          transform: headerVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.7s ease 0.2s',
          fontSize: '13px',
          color: '#444',
          letterSpacing: '0.08em',
          lineHeight: '1.8',
          maxWidth: '480px',
          marginBottom: '64px',
        }}>
          Agent-based crowd simulation with predictive congestion analysis.
          Model disaster scenarios across multi-floor university buildings.
        </p>

        {/* Stats row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1px',
          marginBottom: '64px',
          background: 'rgba(255,255,255,0.04)',
        }}>
          <StatCard label="Simulation Engine" value="ABS" unit="agent-based" color="#00ffb4" delay={600} />
          <StatCard label="Max Agent Load" value="500" unit="agents" color="#00ffb4" delay={750} />
          <StatCard label="Disaster Modes" value="02" unit="scenarios" color="#ff6b35" delay={900} />
          <StatCard label="Data Backend" value="PG" unit="supabase" color="#00ffb4" delay={1050} />
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '32px',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.8s ease 0.8s',
        }}>
          <span style={{ fontSize: '10px', letterSpacing: '0.2em', color: '#333', textTransform: 'uppercase' }}>
            Select Mode
          </span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
        </div>

        {/* Action buttons — Simulate and Analysis */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '16px',
          marginBottom: '64px',
        }}>
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

        {/* Bottom info strip */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          paddingTop: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 1s ease 1.4s',
        }}>
          <div style={{ display: 'flex', gap: '32px' }}>
            {[
              { label: 'Rendering', value: 'PixiJS' },
              { label: 'Map', value: 'Leaflet + CartoDB' },
              { label: 'Storage', value: 'Supabase' },
            ].map((item, i) => (
              <div key={i}>
                <p style={{ fontSize: '9px', color: '#333', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '4px' }}>
                  {item.label}
                </p>
                <p style={{ fontSize: '11px', color: '#555', fontFamily: 'monospace' }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '9px', color: '#2a2a2a', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Software Engineering Project © 2025
          </div>
        </div>

      </div>
    </div>
  )
}