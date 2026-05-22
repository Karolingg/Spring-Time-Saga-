'use client'

import { useState, useRef, useEffect } from 'react'

interface InfoTooltipProps {
  title: string
  description: string
  children?: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function InfoTooltip({
  title,
  description,
  children,
  position = 'top',
}: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isVisible) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isVisible])

  const positionStyles: Record<string, React.CSSProperties> = {
    top: {
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginBottom: '8px',
    },
    bottom: {
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginTop: '8px',
    },
    left: {
      right: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginRight: '8px',
    },
    right: {
      left: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginLeft: '8px',
    },
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        ref={triggerRef}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setIsVisible(!isVisible)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsVisible(!isVisible)
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Information"
      >
        {children || (
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#2db8b0',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold',
              marginLeft: '4px',
            }}
          >
            ?
          </div>
        )}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          style={{
            position: 'absolute',
            ...positionStyles[position],
            background: '#1f2937',
            color: '#f3f4f6',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            width: '360px',
            maxWidth: 'calc(100vw - 24px)',
            zIndex: 1000,
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            wordWrap: 'break-word',
          }}
        >
          <div style={{ fontWeight: '600', marginBottom: '4px', color: '#2db8b0' }}>
            {title}
          </div>
          <div style={{ fontSize: '13px', lineHeight: '1.5' }}>{description}</div>
        </div>
      )}
    </div>
  )
}
