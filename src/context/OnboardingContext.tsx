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

function cloneInitialSteps(): OnboardingStep[] {
  return INITIAL_STEPS.map((step) => ({ ...step }))
}

function getInitialOnboardingState(): {
  hasSeenOnboarding: boolean
  currentStep: number
  steps: OnboardingStep[]
} {
  if (typeof window === 'undefined') {
    return { hasSeenOnboarding: false, currentStep: 0, steps: cloneInitialSteps() }
  }

  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    return { hasSeenOnboarding: false, currentStep: 0, steps: cloneInitialSteps() }
  }

  try {
    const { completed, current } = JSON.parse(stored) as {
      completed?: Record<string, boolean>
      current?: number
    }
    const steps = cloneInitialSteps().map((step) => ({
      ...step,
      completed: completed?.[step.id] ?? false,
    }))
    const currentStep = typeof current === 'number' ? current : 0
    return {
      hasSeenOnboarding: true,
      currentStep: Math.max(0, Math.min(currentStep, steps.length - 1)),
      steps,
    }
  } catch (err) {
    console.error('Failed to load onboarding state:', err)
    return { hasSeenOnboarding: false, currentStep: 0, steps: cloneInitialSteps() }
  }
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [initialState] = useState(getInitialOnboardingState)
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(initialState.hasSeenOnboarding)
  const [currentStep, setCurrentStepState] = useState(initialState.currentStep)
  const [steps, setSteps] = useState<OnboardingStep[]>(initialState.steps)

  // Persist to localStorage
  useEffect(() => {
    const state = {
      completed: Object.fromEntries(steps.map((s) => [s.id, s.completed])),
      current: currentStep,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [steps, currentStep])

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
