'use client'

import { useState } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useOnboarding } from '@/src/hooks/useOnboarding'

// Icon components
function GaugeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}>
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 7v5l3 2"/>
      <path d="M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0"/>
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}>
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )
}

function ExitIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}>
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}>
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}

function FireIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}>
      <path d="M8.56 2.75c4.37 6.03 6.3 9.42 8.75 17.72m2.75-15.02c3.72 3.72 4.5 8.49 5.75 13.48M2 10s5.75-11 13.48-5.75"/>
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )
}

function CloudIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}>
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
    </svg>
  )
}

function BlockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}>
      <path d="M6 9l6-6 6 6v6l-6 6-6-6V9z"/>
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}>
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  )
}

function TrendingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 17"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="12" y1="13" x2="12" y2="17"/>
      <line x1="9" y1="15" x2="15" y2="15"/>
    </svg>
  )
}

const SECTION_CARD: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid #e5e7eb',
  borderRadius: '14px',
  padding: '28px 32px',
  marginBottom: '24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
}

const SECTION_TITLE: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: '700',
  color: '#1f2937',
  marginBottom: '16px',
  marginTop: 0,
}

const SUBSECTION_TITLE: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#374151',
  marginBottom: '12px',
  marginTop: '20px',
}

const METRIC_BOX: React.CSSProperties = {
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  padding: '16px',
  marginBottom: '12px',
}

export default function HelpPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()
  const { resetOnboarding } = useOnboarding()
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'simulation' | 'analysis' | 'glossary'
  >('dashboard')

  if (isAuthLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        Loading...
      </div>
    )
  }

  if (!isAuthenticated) {
    router.push('/auth')
    return null
  }

  return (
    <div
      style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '40px 24px',
        paddingTop: '100px',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1
          style={{
            fontSize: '32px',
            fontWeight: '800',
            color: '#1f2937',
            margin: 0,
          }}
        >
          Help & Guide
        </h1>
        <p
          style={{
            fontSize: '16px',
            color: '#6b7280',
            marginTop: '8px',
            marginBottom: 0,
          }}
        >
          Learn how to use EVACSIM and understand evacuation simulation metrics
        </p>
      </div>

      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          borderBottom: '2px solid #e5e7eb',
          marginBottom: '32px',
          overflowX: 'auto',
        }}
      >
        {(['dashboard', 'simulation', 'analysis', 'glossary'] as const).map(
          (tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 0',
                border: 'none',
                background: 'transparent',
                fontSize: '16px',
                fontWeight: '600',
                color: activeTab === tab ? '#2db8b0' : '#6b7280',
                cursor: 'pointer',
                borderBottom:
                  activeTab === tab ? '3px solid #2db8b0' : 'none',
                transition: 'all 0.2s ease-in-out',
                textTransform: 'capitalize',
                minWidth: 'max-content',
              }}
            >
              {tab === 'dashboard' && 'Dashboard Metrics'}
              {tab === 'simulation' && 'Running Simulations'}
              {tab === 'analysis' && 'Analyzing Results'}
              {tab === 'glossary' && 'Glossary'}
            </button>
          )
        )}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div>
          <div style={SECTION_CARD}>
            <h2 style={SECTION_TITLE}>Dashboard Overview</h2>
            <p style={{ color: '#4b5563', lineHeight: '1.6' }}>
              The dashboard provides an at-a-glance view of your campus evacuation
              readiness. It displays aggregate statistics from all your simulation
              runs, helping you identify trends and areas needing improvement.
            </p>
          </div>

          {/* Readiness Score */}
          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}><GaugeIcon /> Campus Readiness Score</h3>
            <p style={{ color: '#4b5563', lineHeight: '', marginBottom: '16px' }}>
              A composite score (0-100) that reflects your campus evacuation
              preparedness based on simulation data.
            </p>
            <div style={METRIC_BOX}>
              <strong>Score Ranges:</strong>
              <ul style={{ marginTop: '1px', marginBottom: 0, paddingLeft: '20px' }}>
                <li>
                  <strong style={{ color: '#22c55e' }}>80-100 (Excellent):</strong> Building
                  meets evacuation standards; minimal risk
                </li>
                <li>
                  <strong style={{ color: '#2db8b0' }}>60-79 (Good):</strong> Building
                  performs well; some improvements recommended
                </li>
                <li>
                  <strong style={{ color: '#f59e0b' }}>40-59 (Fair):</strong> Several areas
                  need attention
                </li>
                <li>
                  <strong style={{ color: '#ef4444' }}>0-39 (Needs Work):</strong> Critical
                  issues require immediate attention
                </li>
              </ul>
            </div>
            <p
              style={{
                fontSize: '13px',
                color: '#6b7280',
                marginTop: '16px',
                marginBottom: 0,
              }}
            >
              <strong>How it&apos;s calculated:</strong> Evacuation rate (40% weight) +
              bottleneck analysis (30%) + evacuation time efficiency (30%)
            </p>
          </div>

          {/* Total Runs */}
          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}><ChartIcon /> Total Simulation Runs</h3>
            <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: '12px' }}>
              The total number of evacuation simulations you&apos;ve run across all
              buildings and disaster types.
            </p>
            <div style={METRIC_BOX}>
              <p style={{ margin: 0, color: '#374151' }}>
                Tip: Run simulations with different occupancy levels and hazard
                scenarios to get comprehensive coverage of your building&apos;s evacuation
                capabilities.
              </p>
            </div>
          </div>

          {/* Evacuation Rate */}
          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}><ExitIcon /> Average Evacuation Rate (%)</h3>
            <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: '12px' }}>
              The percentage of occupants who successfully evacuated in your
              simulations (excluded trapped occupants).
            </p>
            <div style={METRIC_BOX}>
              <strong>Interpretation:</strong>
              <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
                <li>
                  <strong>&gt;95%:</strong> Excellent egress; minimal safety concerns
                </li>
                <li>
                  <strong>85-95%:</strong> Good performance; some occupants may get
                  blocked
                </li>
                <li>
                  <strong>75-85%:</strong> Moderate risk; hazard placement creates
                  bottlenecks
                </li>
                <li>
                  <strong>&lt;75%:</strong> High risk; critical evacuation issues
                  detected
                </li>
              </ul>
            </div>
          </div>

          {/* Total Agents */}
          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}><UsersIcon /> Total Agents Simulated</h3>
            <p style={{ color: '#4b5563', lineHeight: '1.6' }}>
              The cumulative number of virtual occupants across all your simulation
              runs. Higher numbers indicate more comprehensive testing.
            </p>
          </div>

          {/* Bottlenecks */}
          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}><AlertIcon /> Average Bottlenecks Per Run</h3>
            <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: '12px' }}>
              The average number of zones or corridors that become critically congested
              (more than 50% of occupants bunching in one area).
            </p>
            <div style={METRIC_BOX}>
              <strong>What it means:</strong>
              <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
                <li>
                  <strong>0-1 bottleneck:</strong> Excellent floor layout; traffic flows
                  smoothly
                </li>
                <li>
                  <strong>1-3 bottlenecks:</strong> Acceptable; some crowding at exits
                </li>
                <li>
                  <strong>&gt;3 bottlenecks:</strong> Poor design; occupants queue in
                  multiple areas
                </li>
              </ul>
            </div>
          </div>

          {/* Evacuation Time */}
          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}><ClockIcon /> Average Evacuation Time (seconds)</h3>
            <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: '12px' }}>
              The average time in seconds from simulation start until the last
              occupant evacuates the building.
            </p>
            <div style={METRIC_BOX}>
              <strong>Benchmarks (for small buildings):</strong>
              <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
                <li>
                  <strong>&lt;60 seconds:</strong> Excellent; exceeds fire code
                  requirements
                </li>
                <li>
                  <strong>60-120 seconds:</strong> Good; meets standard guidelines
                </li>
                <li>
                  <strong>120-180 seconds:</strong> Fair; acceptable with conditions
                </li>
                <li>
                  <strong>&gt;180 seconds:</strong> Concerning; may not meet codes
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Simulation Tab */}
      {activeTab === 'simulation' && (
        <div>
          <div style={SECTION_CARD}>
            <h2 style={SECTION_TITLE}>Running Evacuation Simulations</h2>
            <p style={{ color: '#4b5563', lineHeight: '1.6' }}>
              A step-by-step guide to setting up and running fire and earthquake
              evacuation simulations.
            </p>
          </div>

          {/* Step 1: Building Selection */}
          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}>Step 1: Select a Building</h3>
            <ol style={{ color: '#4b5563', lineHeight: '1.8' }}>
              <li>Go to the <strong>Campus Map</strong> page</li>
              <li>
                Click on any building marker to view its details (capacity, floors,
                exits, risk level)
              </li>
              <li>Click <strong>&quot;Run Drill&quot;</strong> to proceed to disaster selection</li>
            </ol>
          </div>

          {/* Step 2: Disaster Selection */}
          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}>Step 2: Choose Disaster Type & Floor</h3>
            <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: '16px' }}>
              Select the type of emergency scenario you want to simulate:
            </p>
            <div style={METRIC_BOX}>
              <strong><FireIcon /> Fire Drill:</strong>
              <p style={{ margin: '8px 0 0 0', color: '#4b5563' }}>
                Agents move quickly toward the nearest exit, avoiding smoke and flames.
                Best for testing rapid evacuation and crowd-based rerouting.
              </p>
            </div>
            <div style={METRIC_BOX}>
              <strong><GlobeIcon /> Earthquake Drill:</strong>
              <p style={{ margin: '8px 0 0 0', color: '#4b5563' }}>
                Agents move cautiously toward stairwell exits while debris blocks key
                pathways. Tests structural resilience and alternative routing.
              </p>
            </div>
            <p
              style={{
                color: '#4b5563',
                lineHeight: '1.6',
                marginTop: '16px',
                marginBottom: 0,
              }}
            >
              Select your target floor and click <strong>&quot;Simulate&quot;</strong>
            </p>
          </div>

          {/* Step 3: Configure Simulation */}
          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}>Step 3: Configure Simulation Parameters</h3>

            <h4 style={SUBSECTION_TITLE}>Occupancy Level</h4>
            <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: '12px' }}>
              Set the percentage of building capacity occupied. Presets help:
            </p>
            <div style={METRIC_BOX}>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                <li>
                  <strong>Low (35%):</strong> Off-hours, minimal occupancy
                </li>
                <li>
                  <strong>Medium (60%):</strong> Normal operation, default
                </li>
                <li>
                  <strong>High (80%):</strong> Peak usage, classes in session
                </li>
                <li>
                  <strong>Full (100%):</strong> Maximum capacity, stress test
                </li>
              </ul>
            </div>

            <h4 style={SUBSECTION_TITLE}>Place Hazards</h4>
            <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: '12px' }}>
              Click and drag hazards onto the floorplan to simulate obstacles:
            </p>
            <div style={METRIC_BOX}>
              <strong><FireIcon /> Fire:</strong> Expands over time, blocks passages
              <br />
              <strong><CloudIcon /> Smoke/Dust:</strong> Reduces visibility and speed
              <br />
              <strong><BlockIcon /> Debris (Earthquake only):</strong> Blocks corridors and exits
            </div>

            <h4 style={SUBSECTION_TITLE}>Simulation Speed</h4>
            <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: 0 }}>
              Watch in real-time (1x) or speed up to 3x to see results faster.
            </p>
          </div>

          {/* Step 4: Run & Monitor */}
          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}>Step 4: Run Simulation & Monitor</h3>
            <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: '16px' }}>
              Click <strong>&quot;Run Simulation&quot;</strong> to launch the evacuation.
            </p>
            <div style={METRIC_BOX}>
              <strong>During Simulation:</strong>
              <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
                <li>
                  <strong>Green dots:</strong> Agents moving toward exits
                </li>
                <li>
                  <strong>Red shaded areas:</strong> Fire, smoke, or debris hazards
                </li>
                <li>
                  <strong>Real-time stats:</strong> Active agents, evacuated, trapped,
                  and blocked corridors
                </li>
              </ul>
            </div>
          </div>

          {/* Step 5: Review Results */}
          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}>Step 5: Review Results</h3>
            <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: '12px' }}>
              After the simulation completes, the results are automatically saved.
              Review key metrics:
            </p>
            <div style={METRIC_BOX}>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                <li>
                  <strong>Evacuation Time:</strong> How long the evacuation took
                </li>
                <li>
                  <strong>Evacuation Rate:</strong> Percent of occupants who escaped
                </li>
                <li>
                  <strong>Trapped Occupants:</strong> Anyone blocked by hazards
                </li>
                <li>
                  <strong>Exit Usage:</strong> Which exits were used and how much
                </li>
                <li>
                  <strong>Reroutes:</strong> Times agents had to find alternate paths
                </li>
              </ul>
            </div>
          </div>

          {/* Simulation Parameters */}
          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}>Understanding Simulation Metrics</h3>

            <h4 style={SUBSECTION_TITLE}>Active Agents</h4>
            <p style={{ color: '#4b5563', lineHeight: '1.6' }}>
              Occupants still in the building and moving toward exits. Decreases as
              agents evacuate or get trapped.
            </p>

            <h4 style={SUBSECTION_TITLE}>Evacuated</h4>
            <p style={{ color: '#4b5563', lineHeight: '1.6' }}>
              Agents who successfully reached an exit and left the building.
            </p>

            <h4 style={SUBSECTION_TITLE}>Trapped</h4>
            <p style={{ color: '#4b5563', lineHeight: '1.6' }}>
              Agents blocked by hazards with no legal evacuation route available.
              This is a critical safety concern.
            </p>

            <h4 style={SUBSECTION_TITLE}>Blocked Edges</h4>
            <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: 0 }}>
              Corridors or pathways completely blocked by hazards, forcing rerouting.
            </p>
          </div>
        </div>
      )}

      {/* Analysis Tab */}
      {activeTab === 'analysis' && (
        <div>
          <div style={SECTION_CARD}>
            <h2 style={SECTION_TITLE}>Analyzing Simulation Results</h2>
            <p style={{ color: '#4b5563', lineHeight: '1.6' }}>
              Learn how to interpret heatmaps, bottleneck analysis, zone metrics,
              and comparison reports.
            </p>
          </div>

          {/* Heatmap */}
          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}><FireIcon /> Congestion Heatmaps</h3>
            <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: '16px' }}>
              Visual representation of occupant density across the floor during
              evacuation.
            </p>
            <div style={METRIC_BOX}>
              <strong>Color Coding:</strong>
              <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
                <li>
                  <strong style={{ color: '#22c55e' }}>Green:</strong> Low density
                  (&lt;20% utilization)
                </li>
                <li>
                  <strong style={{ color: '#f59e0b' }}>Yellow:</strong> Moderate
                  (20-45% utilization)
                </li>
                <li>
                  <strong style={{ color: '#f97316' }}>Orange:</strong> High (45-75%
                  utilization)
                </li>
                <li>
                  <strong style={{ color: '#ef4444' }}>Red:</strong> Critical (75%+
                  utilization)
                </li>
              </ul>
            </div>
          </div>

          {/* Bottleneck Analysis */}
          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}><AlertIcon /> Bottleneck Analysis</h3>
            <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: '12px' }}>
              Identifies corridors, exits, and rooms where occupants bunch up during
              evacuation.
            </p>
            <div style={METRIC_BOX}>
              <strong>Insights:</strong>
              <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
                <li>Bottleneck zones that delayed evacuation</li>
                <li>
                  Peak occupant count at that location and when it occurred
                </li>
                <li>Recommendations for widening exits or redirecting traffic</li>
              </ul>
            </div>
          </div>

          {/* Zone Analysis */}
          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}><ChartIcon /> Zone Analysis</h3>
            <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: '12px' }}>
              Breakdown of occupant movement and density by room or zone.
            </p>
            <div style={METRIC_BOX}>
              <strong>Metrics per zone:</strong>
              <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
                <li>Initial occupant count</li>
                <li>Peak density and timing</li>
                <li>Evacuation duration</li>
                <li>Agents trapped in that zone</li>
              </ul>
            </div>
          </div>

          {/* Exit Utilization */}
          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}><ExitIcon /> Exit Utilization Breakdown</h3>
            <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: '12px' }}>
              Shows which exits occupants used and how heavily each was utilized.
            </p>
            <div style={METRIC_BOX}>
              <strong>What to look for:</strong>
              <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
                <li>Unused exits (may indicate poor signage or layout)</li>
                <li>Overloaded exits (may indicate bottlenecks)</li>
                <li>Balanced distribution (ideal scenario)</li>
              </ul>
            </div>
          </div>

          {/* Run Replay */}
          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}><PlayIcon /> Run Replay</h3>
            <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: '12px' }}>
              Step through your simulation frame-by-frame to understand occupant
              movements and hazard growth.
            </p>
            <div style={METRIC_BOX}>
              <p style={{ margin: '0 0 8px 0', color: '#374151' }}>
                <strong>Controls:</strong> Play/pause, frame step, speed adjustment
              </p>
              <p style={{ margin: 0, color: '#374151' }}>
                Great for identifying when occupants first encounter hazards and how
                they reroute.
              </p>
            </div>
          </div>

          {/* Run Comparison */}
          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}><TrendingIcon /> Run Comparison</h3>
            <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: '12px' }}>
              Side-by-side comparison of two simulation runs with KPI differences
              highlighted.
            </p>
            <div style={METRIC_BOX}>
              <strong>Use for:</strong>
              <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
                <li>Testing the impact of layout changes</li>
                <li>Comparing different hazard scenarios</li>
                <li>Evaluating occupancy level effects</li>
                <li>Before/after improvement validation</li>
              </ul>
            </div>
          </div>

          {/* Reports */}
          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}><DocumentIcon /> Evacuation Reports</h3>
            <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: '12px' }}>
              Printable, comprehensive reports for stakeholder distribution.
            </p>
            <div style={METRIC_BOX}>
              <p style={{ margin: 0, color: '#374151' }}>
                <strong>Includes:</strong> Executive summary, key metrics, heatmaps,
                findings, and recommendations.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Glossary Tab */}
      {activeTab === 'glossary' && (
        <div>
          <div style={SECTION_CARD}>
            <h2 style={SECTION_TITLE}>Glossary of Terms</h2>
          </div>

          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}>General Terms</h3>
            <div style={{ marginBottom: '20px' }}>
              <strong style={{ color: '#1f2937' }}>Agent</strong>
              <p style={{ color: '#4b5563', margin: '4px 0 0 0' }}>
                A virtual occupant in the simulation representing a real person.
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <strong style={{ color: '#1f2937' }}>Evacuation Rate</strong>
              <p style={{ color: '#4b5563', margin: '4px 0 0 0' }}>
                Percentage of occupants who successfully left the building.
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <strong style={{ color: '#1f2937' }}>Hazard</strong>
              <p style={{ color: '#4b5563', margin: '4px 0 0 0' }}>
                An obstacle (fire, smoke, debris) that blocks or slows occupant
                movement.
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <strong style={{ color: '#1f2937' }}>Bottleneck</strong>
              <p style={{ color: '#4b5563', margin: '4px 0 0 0' }}>
                A corridor or exit where occupants bunch up, slowing evacuation.
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <strong style={{ color: '#1f2937' }}>Reroute</strong>
              <p style={{ color: '#4b5563', margin: '4px 0 0 0' }}>
                When an agent changes its path due to encountering a hazard or
                blockage.
              </p>
            </div>

            <div>
              <strong style={{ color: '#1f2937' }}>Trapped</strong>
              <p style={{ color: '#4b5563', margin: '4px 0 0 0' }}>
                An occupant unable to reach an exit due to hazards blocking all
                legal routes.
              </p>
            </div>
          </div>

          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}>Metrics & Scoring</h3>
            <div style={{ marginBottom: '20px' }}>
              <strong style={{ color: '#1f2937' }}>Peak Congestion</strong>
              <p style={{ color: '#4b5563', margin: '4px 0 0 0' }}>
                Maximum number of agents simultaneously on a single corridor or exit
                during the evacuation.
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <strong style={{ color: '#1f2937' }}>Readiness Score</strong>
              <p style={{ color: '#4b5563', margin: '4px 0 0 0' }}>
                Composite 0-100 rating of building evacuation capability based on
                simulation data.
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <strong style={{ color: '#1f2937' }}>Occupancy Ratio</strong>
              <p style={{ color: '#4b5563', margin: '4px 0 0 0' }}>
                Percentage of building capacity currently occupied (0-100%).
              </p>
            </div>

            <div>
              <strong style={{ color: '#1f2937' }}>Evacuation Time</strong>
              <p style={{ color: '#4b5563', margin: '4px 0 0 0' }}>
                Total seconds from simulation start until the last agent evacuates or
                is trapped.
              </p>
            </div>
          </div>

          <div style={SECTION_CARD}>
            <h3 style={SECTION_TITLE}>Disaster Types</h3>
            <div style={{ marginBottom: '20px' }}>
              <strong style={{ color: '#1f2937' }}>Fire Drill</strong>
              <p style={{ color: '#4b5563', margin: '4px 0 0 0' }}>
                Simulation of a fire emergency. Agents move quickly, fire expands,
                and smoke spreads.
              </p>
            </div>

            <div>
              <strong style={{ color: '#1f2937' }}>Earthquake Drill</strong>
              <p style={{ color: '#4b5563', margin: '4px 0 0 0' }}>
                Simulation of an earthquake. Agents move cautiously, debris blocks
                key paths, and stairwells may collapse.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '2px solid #e5e7eb' }}>
        <button
          onClick={() => resetOnboarding()}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: '1px solid #2db8b0',
            background: 'transparent',
            color: '#2db8b0',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s ease-in-out',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#2db8b0'
            e.currentTarget.style.color = 'white'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#2db8b0'
          }}
        >
          🎓 Replay Onboarding Tour
        </button>
        <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '16px', marginBottom: 0 }}>
          Still need help? The info (?) icons throughout the app provide quick tooltips for
          specific metrics.
        </p>
      </div>
    </div>
  )
}
