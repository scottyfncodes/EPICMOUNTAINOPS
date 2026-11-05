import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { EntityType } from '../../shared/types'

/** What the person is looking at — new captures link to it by default. */
export interface CaptureTarget {
  type: EntityType
  id: string
  nodeId?: string
  label: string
  /** When set (e.g. a workflow being edited), images attach to the working draft instead of saving directly. */
  onAttachImage?: (imageId: string) => void
}

export type CaptureMode = 'menu' | 'observation' | 'question' | 'screenshot'

interface CaptureValue {
  target: CaptureTarget | null
  setTarget: (t: CaptureTarget | null) => void
  isOpen: boolean
  mode: CaptureMode
  /** Open the capture sheet, optionally for a specific target instead of the page's. */
  open: (mode?: CaptureMode, target?: CaptureTarget | null) => void
  close: () => void
  override: CaptureTarget | null | undefined
}

const Ctx = createContext<CaptureValue | null>(null)

export function CaptureProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<CaptureTarget | null>(null)
  const [override, setOverride] = useState<CaptureTarget | null | undefined>(undefined)
  const [isOpen, setOpen] = useState(false)
  const [mode, setMode] = useState<CaptureMode>('menu')
  const open = useCallback((m: CaptureMode = 'menu', t?: CaptureTarget | null) => {
    setMode(m)
    setOverride(t)
    setOpen(true)
  }, [])
  const close = useCallback(() => setOpen(false), [])
  const value = useMemo(() => ({ target, setTarget, isOpen, mode, open, close, override }), [target, isOpen, mode, open, close, override])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCapture() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCapture outside provider')
  return v
}

/** Register the current page as the default capture target while mounted. */
export function useCaptureTarget(t: CaptureTarget | null) {
  const { setTarget } = useCapture()
  const latest = useRef(t)
  latest.current = t
  const key = t ? `${t.type}:${t.id}:${t.nodeId ?? ''}:${t.label}:${Boolean(t.onAttachImage)}` : ''
  useEffect(() => {
    setTarget(latest.current)
    return () => setTarget(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setTarget])
}
