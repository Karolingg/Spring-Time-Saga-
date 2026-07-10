'use client'

import { useRef } from 'react'
import { useFocusTrap } from '@/src/hooks/useFocusTrap'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  confirmColor?: string
  isConfirming?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmColor = '#ef4444',
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Trap Tab inside the dialog, close on Escape, restore focus on close.
  useFocusTrap(dialogRef, isOpen, onCancel)

  if (!isOpen) return null

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        className="fade-in-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', borderRadius: '16px',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.4)',
          padding: '32px', maxWidth: '420px', width: '100%',
        }}
      >
        <h2 id="confirm-modal-title" style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
          {title}
        </h2>
        <p id="confirm-modal-message" style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="hover-darken"
            style={{
              padding: '9px 18px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--bg-subtle)',
              fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)',
              cursor: isConfirming ? 'not-allowed' : 'pointer',
              opacity: isConfirming ? 0.65 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isConfirming}
            className="hover-darken"
            style={{
              padding: '9px 18px', borderRadius: '8px',
              border: 'none', background: confirmColor,
              fontSize: '14px', fontWeight: '600', color: '#ffffff',
              cursor: isConfirming ? 'not-allowed' : 'pointer',
              opacity: isConfirming ? 0.75 : 1,
              display: 'inline-flex', alignItems: 'center', gap: '8px',
            }}
          >
            {isConfirming && <span className="spinner" style={{ width: '13px', height: '13px', borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#ffffff' }} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
