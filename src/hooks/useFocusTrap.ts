'use client'

import { useEffect, RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Traps keyboard focus inside `containerRef` while `active` is true:
 * - Focuses the first focusable element on activation (or the container).
 * - Tab / Shift+Tab wrap within the container.
 * - Escape calls `onClose`.
 * - On deactivation, focus returns to the element focused before activation.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onClose?: () => void,
) {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter(el => el.offsetParent !== null || el === document.activeElement)

    // Move focus inside the trap. rAF lets open-animations mount first.
    const focusFrame = requestAnimationFrame(() => {
      if (container.contains(document.activeElement)) return
      const focusable = getFocusable()
      if (focusable.length > 0) {
        focusable[0].focus()
      } else {
        container.setAttribute('tabindex', '-1')
        container.focus()
      }
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose?.()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = getFocusable()
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const current = document.activeElement as HTMLElement | null

      if (event.shiftKey) {
        if (current === first || !container.contains(current)) {
          event.preventDefault()
          last.focus()
        }
      } else {
        if (current === last || !container.contains(current)) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown, true)
      previouslyFocused?.focus?.()
    }
  }, [containerRef, active, onClose])
}
