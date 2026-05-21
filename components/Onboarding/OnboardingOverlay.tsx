'use client'

import { useEffect, useState } from 'react'
import { useOnboarding } from '@/src/hooks/useOnboarding'

interface OnboardingOverlayProps {
  currentPage: string
}

export function OnboardingOverlay({ currentPage }: OnboardingOverlayProps) {
  const { hasSeenOnboarding, currentStep, steps, setCurrentStep, skipOnboarding } = useOnboarding()
  const [isVisible, setIsVisible] = useState(false)

  const relevantSteps = steps.filter(
    (step) =>
      step.page === currentPage && (step.id === steps[currentStep]?.id || !step.completed)
  )

  useEffect(() => {
    // Show overlay if user hasn't completed onboarding and there are relevant steps
    setIsVisible(!hasSeenOnboarding && relevantSteps.length > 0)
  }, [hasSeenOnboarding, relevantSteps])

  if (!isVisible || relevantSteps.length === 0) return null

  const step = steps[currentStep]
  if (!step) return null

  const progress = steps.filter((s) => s.completed).length

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.3s ease-in-out',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '40px',
          maxWidth: '500px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1f2937',
              margin: '0 0 8px 0',
            }}
          >
            {step.title}
          </h2>
          <div
            style={{
              fontSize: '13px',
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Step {currentStep + 1} of {steps.length}
          </div>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: '16px',
            color: '#4b5563',
            lineHeight: '1.6',
            marginBottom: '32px',
          }}
        >
          {step.description}
        </p>

        {/* Progress Bar */}
        <div
          style={{
            height: '6px',
            background: '#e5e7eb',
            borderRadius: '3px',
            marginBottom: '24px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              background: '#2db8b0',
              width: `${((currentStep + 1) / steps.length) * 100}%`,
              transition: 'width 0.3s ease-in-out',
            }}
          />
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={() => skipOnboarding()}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: '#f9fafb',
              color: '#374151',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease-in-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f3f4f6'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f9fafb'
            }}
          >
            Skip Tour
          </button>

          <button
            onClick={() => {
              if (currentStep < steps.length - 1) {
                setCurrentStep(currentStep + 1)
              } else {
                skipOnboarding()
              }
            }}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: '#2db8b0',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s ease-in-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#1f9189'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#2db8b0'
            }}
          >
            {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
