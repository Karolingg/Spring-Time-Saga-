interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  confirmColor?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmColor = '#ef4444',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: '#ffffff', borderRadius: '16px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-md)',
        padding: '32px', maxWidth: '420px', width: '100%',
      }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
          {title}
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '9px 18px', borderRadius: '8px',
              border: '1px solid var(--border)', background: '#f8fafc',
              fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '9px 18px', borderRadius: '8px',
              border: 'none', background: confirmColor,
              fontSize: '14px', fontWeight: '600', color: '#ffffff', cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
