'use client'

import { createContext, useCallback, useEffect, useState } from 'react'

export interface OnboardingStep {
  id: string
  title: string
  description: string
  page: string
  completed: boolean
}

interface OnboardingContextType {
  hasSeenOnboarding: boolean
  currentStep: number
  steps: OnboardingStep[]
  completeStep: (stepId: string) => void
  skipOnboarding: () => void
  resetOnboarding: () => void
  setCurrentStep: (step: number) => void
}

export const OnboardingContext = createContext<OnboardingContextType | undefined>(
  undefined
)

const INITIAL_STEPS: OnboardingStep[] = [
  {
    id: 'dashboard-intro',
    title: 'Welcome to EVACSIM',
    description:
      'Evacuation simulation platform for analyzing campus building evacuation scenarios.',
    page: 'dashboard',
    completed: false,
  },
  {
    id: 'dashboard-stats',
    title: 'Dashboard Metrics',
    description:
      'Track your campus readiness with aggregate evacuation statistics and performance metrics.',
    page: 'dashboard',
    completed: false,
  },
  {
    id: 'building-selection',
    title: 'Select Buildings',
    description: 'Choose a campus building from the interactive map to run evacuation drills.',
    page: 'map',
    completed: false,
  },
  {
    id: 'disaster-selection',
    title: 'Choose Disaster Type',
    description: 'Select between fire or earthquake scenarios to run realistic evacuation simulations.',
    page: 'disaster',
    completed: false,
  },
  {
    id: 'simulation-setup',
    title: 'Configure Simulation',
    description:
      'Set occupancy levels, place hazards, and adjust simulation parameters before running.',
    page: 'autonomous',
    completed: false,
  },
  {
    id: 'simulation-run',
    title: 'Run Simulation',
    description:
      'Watch agents navigate the building, reroute around hazards, and track evacuation metrics.',
    page: 'autonomous',
    completed: false,
  },
  {
    id: 'analysis',
    title: 'Analyze Results',
    description: 'Review heatmaps, bottlenecks, zone analysis, and detailed evacuation reports.',
    page: 'analysis',
    completed: false,
  },
]

const STORAGE_KEY = 'evacsim-onboarding-state'

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false)
  const [currentStep, setCurrentStepState] = useState(0)
  const [steps, setSteps] = useState<OnboardingStep[]>(INITIAL_STEPS)
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const { completed, current } = JSON.parse(stored)
        setSteps((prev) =>
          prev.map((step) => ({
            ...step,
            completed: completed[step.id] ?? false,
          }))
        )
        setCurrentStepState(current ?? 0)
        setHasSeenOnboarding(true)
      } catch (err) {
        console.error('Failed to load onboarding state:', err)
      }
    }
    setIsInitialized(true)
  }, [])

  // Persist to localStorage
  useEffect(() => {
    if (!isInitialized) return
    const state = {
      completed: Object.fromEntries(steps.map((s) => [s.id, s.completed])),
      current: currentStep,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [steps, currentStep, isInitialized])

  const completeStep = useCallback((stepId: string) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, completed: true } : step
      )
    )
  }, [])

  const skipOnboarding = useCallback(() => {
    setHasSeenOnboarding(true)
    setSteps((prev) => prev.map((step) => ({ ...step, completed: true })))
  }, [])

  const resetOnboarding = useCallback(() => {
    setHasSeenOnboarding(false)
    setCurrentStepState(0)
    setSteps(INITIAL_STEPS)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const setCurrentStep = useCallback((step: number) => {
    setCurrentStepState(Math.max(0, Math.min(step, steps.length - 1)))
  }, [steps.length])

  return (
    <OnboardingContext.Provider
      value={{
        hasSeenOnboarding,
        currentStep,
        steps,
        completeStep,
        skipOnboarding,
        resetOnboarding,
        setCurrentStep,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  )
}
