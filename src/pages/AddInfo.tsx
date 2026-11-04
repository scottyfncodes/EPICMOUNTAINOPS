import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Entity, EntityType, Workflow } from '../../shared/types'
import { EntityEditor } from '../components/Editor'
import { blankEntity, RefPicker } from '../components/Forms'
import { Icon, type IconName } from '../components/Icon'
import { PageHeader } from '../components/ui'
import { uploadImageFile } from '../lib/images'
import { hrefFor } from '../lib/meta'
import { useAtlas, useStore } from '../lib/store'

const OPTIONS: { key: string; title: string; body: string; icon: IconName }[] = [
  { key: 'workflow', title: 'New workflow', body: 'Map a process from start to finish.', icon: 'flow' },
  { key: 'step', title: 'New step', body: 'Add a step to an existing workflow.', icon: 'plus' },
  { key: 'system', title: 'System or program', body: 'Software, internal program, tool or reference.', icon: 'system' },
  { key: 'equipment', title: 'Equipment', body: 'Something used on the floor or in the shop.', icon: 'wrench' },
  { key: 'glossary', title: 'Glossary entry', body: 'An acronym or term you keep hearing.', icon: 'book' },
  { key: 'screenshot', title: 'Screenshot', body: 'Upload an image and attach it to anything.', icon: 'camera' },
  { key: 'observation', title: 'Observation', body: 'Something you saw first-hand.', icon: 'eye' },
  { key: 'question', title: 'Question', body: 'Something that needs clarification.', icon: 'question' },
]

export function AddInfo() {
  const { kind } = useParams()
  const { canEdit, requestEdit } = useStore()
  const navigate = useNavigate()

  if (!canEdit) {
    return (
      <div className="page">
        <PageHeader kicker="Knowledge capture" title="Add information" sub="Adding and editing content needs your edit key." />
        <button className="btn btn--primary" onClick={requestEdit}>
          <Icon name="key" size={16} /> Unlock editing
        </button>
      </div>
    )
  }

  const entityFor = (k: string): Entity | null => {
    switch (k) {
      case 'workflow':
      case 'system':
      case 'equipment':
      case 'glossary':
        return blankEntity(k as EntityType)
      case 'observation':
        return blankEntity('note', { kind: 'observation', status: 'observed' } as any)
      case 'question':
        return blankEntity('note', { kind: 'question', status: 'unverified' } as any)
    }
    return null
  }

  const entity = kind ? entityFor(kind) : null

  return (
    <div className="page">
      <PageHeader
        kicker="Knowledge capture"
        title="Add information"
        sub="Capture what you learn while it’s fresh. New items start as Unverified or Observed — you decide when something is Verified."
      />
      <div className="addgrid">
        {OPTIONS.map((o) => (
          <Link key={o.key} to={`/add/${o.key}`} className={`addtile ${kind === o.key ? 'is-on' : ''}`}>
            <Icon name={o.icon} size={22} />
            <span className="addtile__title">{o.title}</span>
            <span className="addtile__body">{o.body}</span>
          </Link>
        ))}
      </div>
      {kind === 'step' && <AddStep />}
      {kind === 'screenshot' && <AddScreenshot />}
      {entity && (
        <EntityEditor
          key={kind}
          entity={entity}
          open
          isNew
          navigateOnCreate
          onClose={() => navigate('/add', { replace: true })}
        />
      )}
    </div>
  )
}

function AddStep() {
  const atlas = useAtlas()
  const navigate = useNavigate()
  const workflows = atlas.list('workflow')
  return (
    <section className="section panel">
      <h2 className="section__title">Which workflow?</h2>
      <p className="muted">The workflow opens in edit mode with a new step ready to describe.</p>
      <ul className="rowlist">
        {workflows.map((w: Workflow) => (
          <li key={w.id}>
            <button className="rowlink" onClick={() => navigate(`${hrefFor(w)}?edit=1&add=step`)}>
              <Icon name="flow" size={18} className="rowlink__icon" />
              <span className="rowlink__main">
                <span className="rowlink__title">
                  <span className="chip__code">{w.code}</span>
                  {w.title}
                </span>
                <span className="rowlink__sub">{w.nodes.length} steps</span>
              </span>
              <Icon name="chevron" size={16} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function AddScreenshot() {
  const atlas = useAtlas()
  const { addImage, save, toast } = useStore()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [target, setTarget] = useState<string[]>([])
  const [nodeId, setNodeId] = useState('')
  const [busy, setBusy] = useState(false)
  const targetEntity = atlas.get(target[0])

  return (
    <section className="section panel">
      <h2 className="section__title">Upload a screenshot</h2>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0] || null
          setFile(f)
          setPreview(f ? URL.createObjectURL(f) : null)
        }}
      />
      <button className="dropzone" onClick={() => input.current?.click()}>
        {preview ? <img src={preview} alt="Selected screenshot preview" /> : (
          <>
            <Icon name="camera" size={28} />
            <span>Choose a photo or screenshot</span>
            <small>Images are resized and stripped of location data before upload.</small>
          </>
        )}
      </button>
      <div className="form">
        <div className="fi">
          <label className="fi__label" htmlFor="shot-caption">Caption</label>
          <input id="shot-caption" className="input" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What does this show?" />
        </div>
        <div className="fi">
          <span className="fi__label">Attach to (optional)</span>
          <RefPicker types={['workflow', 'system', 'equipment', 'department', 'glossary']} value={target} onChange={(ids) => setTarget(ids.slice(-1))} single />
        </div>
        {targetEntity?.type === 'workflow' && (
          <div className="fi">
            <label className="fi__label" htmlFor="shot-node">Step</label>
            <select id="shot-node" className="input" value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
              <option value="">The workflow itself</option>
              {targetEntity.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          className="btn btn--primary btn--block"
          disabled={!file || busy}
          onClick={async () => {
            if (!file) return
            setBusy(true)
            try {
              const meta = await uploadImageFile(file, caption || undefined)
              addImage(meta)
              if (targetEntity) {
                if (targetEntity.type === 'workflow' && nodeId) {
                  await save({ ...targetEntity, nodes: targetEntity.nodes.map((n) => (n.id === nodeId ? { ...n, imageIds: [...new Set([...(n.imageIds || []), meta.id])] } : n)) }, { note: 'Attached screenshot', quiet: true })
                } else {
                  await save({ ...targetEntity, imageIds: [...new Set([...(targetEntity.imageIds || []), meta.id])] }, { note: 'Attached screenshot', quiet: true })
                }
              }
              toast(targetEntity ? `Screenshot attached to “${targetEntity.title}”` : 'Screenshot added to the library')
              setFile(null)
              setPreview(null)
              setCaption('')
            } catch (err) {
              toast((err as Error).message, 'error')
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </section>
  )
}
