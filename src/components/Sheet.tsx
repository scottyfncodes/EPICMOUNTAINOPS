import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

/**
 * Detail panel. On phones it is a draggable bottom sheet (half / full);
 * on wide screens it docks to the right. `modal` variants dim the page.
 */
export function Sheet({
  open,
  onClose,
  title,
  kicker,
  children,
  footer,
  modal = false,
  size = 'half',
  onSizeChange,
  className = '',
  labelledBy,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  kicker?: ReactNode
  children: ReactNode
  footer?: ReactNode
  modal?: boolean
  size?: 'half' | 'full'
  onSizeChange?: (s: 'half' | 'full') => void
  className?: string
  labelledBy?: string
}) {
  const [drag, setDrag] = useState(0)
  const start = useRef<number | null>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open && modal) panel.current?.focus()
  }, [open, modal])

  if (!open) return null

  const onDown = (e: React.PointerEvent) => {
    start.current = e.clientY
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (start.current === null) return
    setDrag(e.clientY - start.current)
  }
  const onUp = () => {
    if (start.current === null) return
    const dy = drag
    start.current = null
    setDrag(0)
    if (dy < -50) onSizeChange?.('full')
    else if (dy > 70) {
      if (size === 'full' && onSizeChange) onSizeChange('half')
      else onClose()
    } else if (Math.abs(dy) < 6 && onSizeChange) onSizeChange(size === 'full' ? 'half' : 'full')
  }

  const body = (
    <>
      {modal && <div className="scrim" onClick={onClose} aria-hidden="true" />}
      <div
        ref={panel}
        className={`sheet sheet--${size} ${modal ? 'sheet--modal' : ''} ${className}`}
        style={drag ? { transform: `translateY(${Math.max(-80, drag)}px)`, transition: 'none' } : undefined}
        role={modal ? 'dialog' : 'complementary'}
        aria-modal={modal || undefined}
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        <div
          className="sheet__grip"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          role="button"
          tabIndex={0}
          aria-label={size === 'full' ? 'Collapse panel' : 'Expand panel'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onSizeChange?.(size === 'full' ? 'half' : 'full')
          }}
        >
          <span />
        </div>
        <div className="sheet__head">
          <div className="sheet__titles">
            {kicker && <div className="kicker">{kicker}</div>}
            {title && (
              <h2 className="sheet__title" id={labelledBy}>
                {title}
              </h2>
            )}
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close panel">
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__foot">{footer}</div>}
      </div>
    </>
  )
  return modal ? createPortal(body, document.body) : body
}
