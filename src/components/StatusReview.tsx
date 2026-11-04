import { useEffect, useMemo, useState } from 'react'
import type { Entity, Source, Status } from '../../shared/types'
import { STATUSES } from '../../shared/types'
import { verificationProblem } from '../../shared/validate'
import { STATUS_META, TYPE_META } from '../lib/meta'
import { useStore } from '../lib/store'
import { Icon } from './Icon'
import { Sheet } from './Sheet'
import { StatusBadge, StatusGlyph } from './ui'

const today = () => new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

/**
 * Deliberately change an item's verification status. This is the only place
 * status changes outside full editing, and it never infers a status: the
 * person picks it, and Verified requires a source.
 */
export function StatusReview({ entity, open, onClose }: { entity: Entity; open: boolean; onClose: () => void }) {
  const { atlas, save } = useStore()
  const [status, setStatus] = useState<Status>(entity.status)
  const [source, setSource] = useState(entity.source || '')
  const [sourceIds, setSourceIds] = useState<string[]>(entity.sourceIds || [])
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setStatus(entity.status)
      setSource(entity.source || '')
      setSourceIds(entity.sourceIds || [])
      setNote('')
      setErr(null)
    }
  }, [open, entity])

  const sources = atlas.list('source') as Source[]
  const recentTexts = useMemo(() => {
    const seen = new Map<string, string>()
    for (const e of [...atlas.all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
      if (e.source && !seen.has(e.source)) seen.set(e.source, e.updatedAt)
      if (seen.size >= 4) break
    }
    return [...seen.keys()]
  }, [atlas])

  const submit = async () => {
    const candidate = { ...entity, status, source: source.trim() || undefined, sourceIds }
    const problem = verificationProblem(candidate, (id) => atlas.get<Source>(id))
    if (problem) {
      setErr(problem)
      return
    }
    setBusy(true)
    try {
      const change = status !== entity.status ? `Status ${STATUS_META[entity.status].label} → ${STATUS_META[status].label}` : 'Updated source'
      await save(candidate as Entity, { note: note.trim() ? `${change}: ${note.trim()}` : change })
      onClose()
    } catch {
      /* toast shown */
    } finally {
      setBusy(false)
    }
  }

  const authorizedIds = new Set(sources.filter((s) => s.authorized).map((s) => s.id))

  return (
    <Sheet
      open={open}
      onClose={onClose}
      modal
      kicker={`Review ${TYPE_META[entity.type].label.toLowerCase()}`}
      title={entity.title}
      className="sheet--compact sheet--status"
      footer={
        <div className="editor-foot">
          {err && (
            <div className="editor-foot__err" role="alert">
              <Icon name="warning" size={16} /> {err}
            </div>
          )}
          <div className="row gap-s">
            <span className="grow" />
            <button className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={submit} disabled={busy || (status === entity.status && source === (entity.source || '') && sourceIds.join() === (entity.sourceIds || []).join())}>
              {busy ? 'Saving…' : 'Save review'}
            </button>
          </div>
        </div>
      }
    >
      <div className="form">
        <p className="muted">
          Currently <StatusBadge status={entity.status} />. Nothing changes status automatically — choose deliberately.
        </p>
        <div className="statuspick" role="radiogroup" aria-label="New status">
          {STATUSES.map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={status === s}
              className={`statuspick__opt status--${s} ${status === s ? 'is-on' : ''}`}
              onClick={() => {
                setStatus(s)
                setErr(null)
              }}
            >
              <StatusGlyph status={s} size={16} />
              <b>{STATUS_META[s].label}</b>
              <small>{STATUS_META[s].help}</small>
            </button>
          ))}
        </div>

        <div className="fi">
          <span className="fi__label">Source {status === 'verified' && <span className="fi__req">required for Verified</span>}</span>
          {sources.length > 0 && (
            <div className="quicklabels">
              {sources.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`qchip qchip--wide ${sourceIds.includes(s.id) ? 'is-on' : ''}`}
                  onClick={() => setSourceIds((ids) => (ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id]))}
                  title={s.authorized ? 'Authorized source' : 'Not marked as an authorized source'}
                >
                  {s.authorized && '✓ '}
                  {s.title}
                </button>
              ))}
            </div>
          )}
          <div className="quicklabels">
            {[`First-hand observation, ${today()}`, ...recentTexts.filter((t) => !t.startsWith('First-hand observation'))].slice(0, 4).map((t) => (
              <button key={t} type="button" className={`qchip qchip--wide ${source === t ? 'is-on' : ''}`} onClick={() => setSource(source === t ? '' : t)}>
                {t}
              </button>
            ))}
          </div>
          <input className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Shop training session with lead tech, Nov 4" aria-label="Source" />
          {status === 'verified' && sourceIds.length > 0 && !sourceIds.some((id) => authorizedIds.has(id)) && !source.trim() && (
            <div className="fi__help">None of the linked sources is marked authorized, so they can’t verify this. Describe the authorized source above.</div>
          )}
        </div>
        <div className="fi">
          <label className="fi__label" htmlFor="review-note">
            Note for history <span className="fi__req">optional</span>
          </label>
          <input id="review-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you confirm or change?" />
        </div>
      </div>
    </Sheet>
  )
}
