import { useEffect, useState } from 'react'
import '@/styles/components.css'

export function BlinkingCursor() {
  const [on, setOn] = useState(true)

  useEffect(() => {
    const t = setInterval(() => setOn(v => !v), 530)
    return () => clearInterval(t)
  }, [])

  return <span className={`cursor ${on ? 'visible' : 'hidden'}`} />
}
