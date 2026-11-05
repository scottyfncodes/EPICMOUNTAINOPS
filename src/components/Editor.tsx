import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Entity, VersionRecord } from '../../shared/types'
import { api } from '../lib/api'
import { fmtDate, hrefFor, ID_PREFIX, newId, TYPE_META } from '../lib/meta'
import { useStore } from '../lib/store'
import { FormFields, SCHEMAS, validateEntity } from './Forms'
import { Icon } from './Icon'
import { Sheet } from './Sheet'
import { StatusReview } from './StatusReview'
import { StatusBadge, StatusGlyph } from './ui'

/** Full editor for any entity (create or update). */
export function EntityEditor({
  entity,
  open,
  onClose,
  onSaved,
  isNew = false,
  navigateOnCreate = true,
}: {
  entity: Entity
  open: boolean
  onClose: () => void
  onSaved?: (e: Entity) => void
  isNew?: boolean
  navigateOnCreate?: boolean
}) {
  const { save, remove, atlas } = useStore()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Entity>(entity)
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [size, setSize] = useState<'half' | 'full'>('full')

  useEffect(() => {
    if (open) {
      setDraft(entity)
      setErr(null)
      setNote('')
    }
  }, [open, entity])

  const submit = async () => {
    const problem = validateEntity(draft, (id) => atlas.get(id) as any)
    if (problem) return setErr(problem)
    setBusy(true)
    try {
      const toSave = isNew && !draft.id ? ({ ...draft, id: newId(ID_PREFIX[draft.type], draft.title) } as Entity) : draft
      const saved = await save(toSave, { note: note || undefined })
      onSaved?.(saved)
      onClose()
      if (isNew && navigateOnCreate) navigate(hrefFor(saved), { viewTransition: true })
    } catch {
      /* toast already shown */
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      modal
      size={size}
      onSizeChange={setSize}
      kicker={isNew ? `New ${TYPE_META[entity.type].label.toLowerCase()}` : `Edit ${TYPE_META[entity.type].label.toLowerCase()}`}
      title={draft.title || 'Untitled'}
      labelledBy="editor-title"
      className="sheet--editor"
      footer={
        <div className="editor-foot">
          {err && (
            <div className="editor-foot__err" role="alert">
              <Icon name="warning" size={16} /> {err}
            </div>
          )}
          {!isNew && (
            <input className="input input--compact" placeholder="What changed? (optional, shown in history)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Change note" />
          )}
          <div className="row gap-s">
            {!isNew && (
              <button
                className="btn btn--danger-ghost"
                onClick={async () => {
                  if (!confirm(`Delete “${entity.title}”? It can be restored from version history.`)) return
                  await remove(entity.id)
                  onClose()
                  navigate(-1)
                }}
              >
                <Icon name="trash" size={16} /> Delete
              </button>
            )}
            <span className="grow" />
            <button className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : isNew ? 'Create' : 'Save changes'}
            </button>
          </div>
        </div>
      }
    >
      <FormFields
        schema={SCHEMAS[draft.type]}
        value={draft as any}
        onChange={(patch) => {
          setErr(null)
          setDraft((d) => ({ ...d, ...patch }) as Entity)
        }}
      />
    </Sheet>
  )
}

/** Version history with restore. */
export function HistoryPanel({ entity, open, onClose }: { entity: Entity; open: boolean; onClose: () => void }) {
  const { save, canEdit } = useStore()
  const [versions, setVersions] = useState<VersionRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setVersions(null)
    setError(null)
    api
      .versions(entity.id)
      .then(setVersions)
      .catch((e) => setError(e.message))
  }, [open, entity.id, entity.updatedAt])

  return (
    <Sheet open={open} onClose={onClose} modal title="Version history" kicker={entity.title} size="full">
      {!versions && !error && <div className="skeleton-list" aria-busy="true"><span /><span /><span /></div>}
      {error && <p className="error-text">{error}</p>}
      {versions && versions.length === 0 && <p className="muted">No history recorded yet.</p>}
      {versions && (
        <ol className="history">
          {versions.map((v, i) => (
            <li key={v.id} className="history__item">
              <div className="history__dot" />
              <div className="history__body">
                <div className="row gap-s wrap">
                  <b className="history__action">{v.action}</b>
                  <span className="muted">{fmtDate(v.createdAt, true)}</span>
                  <StatusBadge status={v.data.status} compact />
                  {i === 0 && <span className="tag">Current</span>}
                </div>
                <div className="history__title">{v.data.title}</div>
                {v.note && <div className="history__note">“{v.note}”</div>}
                {canEdit && i > 0 && v.action !== 'delete' && (
                  <button
                    className="btn btn--ghost btn--small"
                    onClick={async () => {
                      if (!confirm('Restore this version? The current version stays in history.')) return
                      await save({ ...v.data, id: entity.id } as Entity, { action: 'restore', note: `Restored version from ${fmtDate(v.createdAt, true)}` })
                      onClose()
                    }}
                  >
                    <Icon name="undo" size={14} /> Restore this version
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  )
}

/** Edit + History buttons for detail pages. */
export function EntityActions({ entity }: { entity: Entity }) {
  const { canEdit, requestEdit } = useStore()
  const [editing, setEditing] = useState(false)
  const [history, setHistory] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  return (
    <>
      <div className="row gap-s wrap">
        <button className="btn btn--ghost" onClick={() => (canEdit ? setReviewing(true) : requestEdit())}>
          <StatusGlyph status={entity.status} size={14} /> Review status
        </button>
        <button className="btn btn--ghost" onClick={() => (canEdit ? setEditing(true) : requestEdit())}>
          <Icon name={canEdit ? 'edit' : 'lock'} size={16} /> Edit
        </button>
        <button className="btn btn--ghost" onClick={() => setHistory(true)}>
          <Icon name="history" size={16} /> History
        </button>
      </div>
      <EntityEditor entity={entity} open={editing} onClose={() => setEditing(false)} />
      <HistoryPanel entity={entity} open={history} onClose={() => setHistory(false)} />
      <StatusReview entity={entity} open={reviewing} onClose={() => setReviewing(false)} />
    </>
  )
}
