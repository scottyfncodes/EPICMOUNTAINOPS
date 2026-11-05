import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import type { GlossaryEntry } from '../../shared/types'
import { hrefFor } from '../lib/meta'
import { Icon } from './Icon'

/**
 * Tapping a glossary term shows its definition right where you are, instead
 * of navigating away from the map or guide. The term stays a real link, so
 * long-press / open-in-new-tab still work.
 */
interface Peek {
  entry: GlossaryEntry
  rect: DOMRect
  origin: HTMLElement
}
const Ctx = createContext<((entry: GlossaryEntry, el: HTMLElement) => void) | null>(null)

export function GlossaryPeekProvider({ children }: { children: ReactNode }) {
  const [peek, setPeek] = useState<Peek | null>(null)
  const open = useCallback((entry: GlossaryEntry, el: HTMLElement) => setPeek({ entry, rect: el.getBoundingClientRect(), origin: el }), [])
  return (
    <Ctx.Provider value={open}>
      {children}
      {peek && <PeekCard peek={peek} onClose={() => setPeek(null)} />}
    </Ctx.Provider>
  )
}

export const useGlossaryPeek = () => useContext(Ctx)

function PeekCard({ peek, onClose }: { peek: Peek; onClose: () => void }) {
  const card = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const { entry, rect, origin } = peek

  useEffect(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const width = Math.min(340, vw - 24)
    const left = Math.max(12, Math.min(vw - width - 12, rect.left + rect.width / 2 - width / 2))
    const h = card.current?.offsetHeight || 180
    const below = rect.bottom + 10
    const top = below + h < vh - 12 ? below : Math.max(12, rect.top - h - 10)
    setPos({ top, left, width })
    card.current?.focus({ preventScroll: true })
  }, [rect])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    const onScroll = () => close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  })

  const close = () => {
    onClose()
    origin.focus?.()
  }

  return createPortal(
    <>
      <div className="peek-scrim" onClick={close} aria-hidden="true" />
      <div
        ref={card}
        className="peek"
        role="dialog"
        aria-modal="false"
        aria-label={`Definition: ${entry.title}`}
        tabIndex={-1}
        style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { visibility: 'hidden', top: 0, left: 0 }}
      >
        <div className="peek__head">
          <Icon name="book" size={14} />
          <b>{entry.title}</b>
          {entry.aka.length > 0 && <span className="peek__aka">{entry.aka.join(' · ')}</span>}
          <button className="iconbtn" onClick={close} aria-label="Close definition">
            <Icon name="close" size={16} />
          </button>
        </div>
        <p className="peek__def">{entry.definition}</p>
        <div className="peek__foot">
          <span className={`status--${entry.status} mono`}>{entry.status}</span>
          <Link to={hrefFor(entry)} className="textlink" onClick={onClose} viewTransition>
            Full entry <Icon name="chevron" size={14} />
          </Link>
        </div>
      </div>
    </>,
    document.body,
  )
}
