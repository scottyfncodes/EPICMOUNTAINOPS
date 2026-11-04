import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Entity, EntityRef, Note, Workflow } from '../../shared/types'
import { api, imageUrl } from '../lib/api'
import { useCapture, type CaptureMode, type CaptureTarget } from '../lib/capture'
import { ID_PREFIX, newId } from '../lib/meta'
import { useStore } from '../lib/store'
import type { AnnotatedImage } from './Annotator'

const Annotator = lazy(() => import('./Annotator').then((m) => ({ default: m.Annotator })))
import { EntityEditor } from './Editor'
import { blankEntity, RefPicker } from './Forms'
import { Icon } from './Icon'
import { Sheet } from './Sheet'
import { StatusBadge, typeIcon } from './ui'

const OBS_TEMPLATES = ['Saw this done differently', 'A step seems to be missing', 'Common mistake I noticed', 'Tip from a coworker', 'This screen / system detail']
const Q_TEMPLATES = ['Who is responsible for this?', 'Which system is used here?', 'What information is required?', 'Is this step still current?', 'What does this term mean?']
const CAPTION_CHIPS = ['System screen', 'Equipment label', 'Setup example', 'Paperwork / tag', 'Workstation']

const today = () => new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

/** Attach an uploaded image to the capture target (step, or any entity). */
export async function attachImageTo(
  t: CaptureTarget,
  imageId: string,
  get: (id: string) => Entity | undefined,
  save: (e: Entity, o?: { note?: string; quiet?: boolean }) => Promise<Entity>,
) {
  if (t.onAttachImage) return t.onAttachImage(imageId)
  const e = get(t.id)
  if (!e) throw new Error('That item no longer exists.')
  if (e.type === 'workflow' && t.nodeId) {
    const wf = e as Workflow
    await save({ ...wf, nodes: wf.nodes.map((n) => (n.id === t.nodeId ? { ...n, imageIds: [...(n.imageIds || []), imageId] } : n)) }, { note: 'Attached screenshot', quiet: true })
  } else {
    await save({ ...e, imageIds: [...(e.imageIds || []), imageId] } as Entity, { note: 'Attached screenshot', quiet: true })
  }
}

export function CaptureSheet() {
  const cap = useCapture()
  const { canEdit, requestEdit } = useStore()
  const [mode, setMode] = useState<CaptureMode>('menu')
  const [about, setAbout] = useState<CaptureTarget | null>(null)
  const [extra, setExtra] = useState<null | 'workflow' | 'glossary'>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (cap.isOpen) {
      setMode(cap.mode)
      setAbout(cap.override !== undefined ? cap.override : cap.target)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cap.isOpen])

  useEffect(() => {
    if (cap.isOpen && !canEdit) {
      cap.close()
      requestEdit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cap.isOpen, canEdit])

  if (!cap.isOpen || !canEdit) {
    return extra ? <EntityEditor entity={blankEntity(extra)} open isNew onClose={() => setExtra(null)} /> : null
  }

  const title = mode === 'menu' ? 'Capture' : mode === 'observation' ? 'New observation' : mode === 'question' ? 'New question' : 'Add a screenshot'
  const isWorkflow = about?.type === 'workflow'

  return (
    <Sheet open onClose={cap.close} modal size="full" kicker="Field capture" title={title} className="sheet--capture" labelledBy="capture-title">
      <AboutBar about={about} onChange={setAbout} />
      {mode === 'menu' && (
        <div className="capgrid">
          <button className="captile captile--primary" onClick={() => setMode('screenshot')}>
            <Icon name="camera" size={26} />
            <b>Screenshot</b>
            <span>Photo or screen, marked up & redacted</span>
          </button>
          <button className="captile" onClick={() => setMode('observation')}>
            <Icon name="eye" size={24} />
            <b>Observation</b>
            <span>Something you saw first-hand</span>
          </button>
          <button className="captile" onClick={() => setMode('question')}>
            <Icon name="question" size={24} />
            <b>Question</b>
            <span>Something to clarify later</span>
          </button>
          {isWorkflow ? (
            <button
              className="captile"
              onClick={() => {
                cap.close()
                navigate(`/workflows/${encodeURIComponent(about!.id)}?edit=1&add=step${about!.nodeId ? `&after=${encodeURIComponent(about!.nodeId)}` : ''}`, {
                  viewTransition: true,
                })
              }}
            >
              <Icon name="plus" size={24} />
              <b>Step</b>
              <span>{about?.nodeId ? 'After the selected step' : 'At the end of this workflow'}</span>
            </button>
          ) : (
            <button
              className="captile"
              onClick={() => {
                cap.close()
                navigate('/add/step')
              }}
            >
              <Icon name="plus" size={24} />
              <b>Step</b>
              <span>Choose a workflow</span>
            </button>
          )}
          <button
            className="captile captile--small"
            onClick={() => {
              cap.close()
              setExtra('glossary')
            }}
          >
            <Icon name="book" size={20} />
            <b>Term</b>
          </button>
          <button
            className="captile captile--small"
            onClick={() => {
              cap.close()
              setExtra('workflow')
            }}
          >
            <Icon name="flow" size={20} />
            <b>Workflow</b>
          </button>
        </div>
      )}
      {(mode === 'observation' || mode === 'question') && <NoteForm kind={mode} about={about} onDone={cap.close} />}
      {mode === 'screenshot' && <ScreenshotFlow about={about} onDone={cap.close} />}
    </Sheet>
  )
}

function AboutBar({ about, onChange }: { about: CaptureTarget | null; onChange: (t: CaptureTarget | null) => void }) {
  const { atlas } = useStore()
  const [picking, setPicking] = useState(false)
  if (picking)
    return (
      <div className="aboutbar aboutbar--pick">
        <span className="aboutbar__label">About</span>
        <RefPicker
          types={['workflow', 'department', 'system', 'equipment', 'glossary']}
          value={[]}
          single
          onChange={(ids) => {
            const e = atlas.get(ids[0])
            if (e) onChange({ type: e.type, id: e.id, label: e.type === 'workflow' && e.code ? `${e.code} ${e.title}` : e.title })
            setPicking(false)
          }}
        />
      </div>
    )
  return (
    <div className="aboutbar">
      <span className="aboutbar__label">About</span>
      {about ? (
        <span className="aboutbar__chip">
          <Icon name={typeIcon(about.type)} size={14} />
          <span>{about.label}</span>
          <button onClick={() => onChange(null)} aria-label="Unlink">
            <Icon name="close" size={12} />
          </button>
        </span>
      ) : (
        <span className="muted">Not linked</span>
      )}
      <button className="textlink" onClick={() => setPicking(true)}>
        {about ? 'Change' : 'Link to…'}
      </button>
    </div>
  )
}

function refOf(t: CaptureTarget | null): EntityRef[] {
  return t ? [{ type: t.type, id: t.id, ...(t.nodeId ? { nodeId: t.nodeId } : {}) }] : []
}

function NoteForm({ kind, about, onDone }: { kind: 'observation' | 'question'; about: CaptureTarget | null; onDone: () => void }) {
  const { save, toast } = useStore()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [source, setSource] = useState(kind === 'observation' ? `First-hand observation, ${today()}` : '')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const templates = kind === 'observation' ? OBS_TEMPLATES : Q_TEMPLATES

  const submit = async () => {
    const t = title.trim() || body.trim().split('\n')[0].slice(0, 120)
    if (!t) return toast('Pick a template or type a headline first.', 'error')
    setBusy(true)
    try {
      const now = new Date().toISOString()
      const note: Note = {
        id: newId(ID_PREFIX.note, t),
        type: 'note',
        kind,
        title: t,
        body: body.trim() || undefined,
        links: refOf(about),
        resolved: false,
        // Observations are first-hand, never "verified"; questions start unverified.
        status: kind === 'observation' ? 'observed' : 'unverified',
        source: source.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      }
      await save(note, { note: kind === 'observation' ? 'Captured observation' : 'Captured question', quiet: true })
      toast(kind === 'observation' ? 'Observation saved — marked Observed' : 'Question added to the Review queue')
      onDone()
    } catch {
      /* toast shown */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="form capform">
      <div className="quicklabels" role="group" aria-label="Templates">
        {templates.map((q) => (
          <button
            key={q}
            type="button"
            className={`qchip qchip--wide ${title === q ? 'is-on' : ''}`}
            onClick={() => {
              setTitle(q)
              input.current?.focus()
            }}
          >
            {q}
          </button>
        ))}
      </div>
      <div className="fi">
        <label className="fi__label" htmlFor="cap-title">
          Headline
        </label>
        <input id="cap-title" ref={input} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'question' ? 'What do you need to find out?' : 'What did you see?'} />
      </div>
      <div className="fi">
        <label className="fi__label" htmlFor="cap-body">
          Details <span className="fi__req">optional · dictation works</span>
        </label>
        <textarea id="cap-body" className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      {kind === 'observation' && (
        <div className="fi">
          <label className="fi__label" htmlFor="cap-source">
            Source
          </label>
          <input id="cap-source" className="input" value={source} onChange={(e) => setSource(e.target.value)} />
          <div className="fi__help">
            Saved as <StatusBadge status="observed" compact /> — you can mark it Verified later only with an authorized source.
          </div>
        </div>
      )}
      <button className="btn btn--primary btn--block" onClick={submit} disabled={busy}>
        {busy ? 'Saving…' : kind === 'observation' ? 'Save observation' : 'Add question'}
      </button>
    </div>
  )
}

function ScreenshotFlow({ about, onDone }: { about: CaptureTarget | null; onDone: () => void }) {
  const { atlas, save, addImage, toast } = useStore()
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [annotating, setAnnotating] = useState(false)
  const [result, setResult] = useState<AnnotatedImage | null>(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)

  const pick = () => fileInput.current?.click()

  const upload = async () => {
    if (!result) return
    setBusy(true)
    try {
      const meta = await api.uploadImage({ ...result, caption: caption.trim() || undefined })
      addImage(meta)
      if (about) await attachImageTo(about, meta.id, (id) => atlas.get(id), save)
      toast(about ? `Screenshot attached to ${about.label}` : 'Screenshot saved to the image library')
      onDone()
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="form capform">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            setFile(f)
            setAnnotating(true)
          }
          e.target.value = ''
        }}
      />
      {!result ? (
        <button className="dropzone" onClick={pick}>
          <Icon name="camera" size={30} />
          <span>Take a photo or choose a screenshot</span>
          <small>Next you can draw arrows, number steps, crop — and redact anything private.</small>
        </button>
      ) : (
        <div className="capshot">
          <img src={result.dataUrl} alt="Marked-up screenshot preview" />
          <div className="row gap-s">
            <button className="btn btn--ghost btn--small" onClick={() => setAnnotating(true)}>
              <Icon name="edit" size={14} /> Mark up again
            </button>
            <button className="btn btn--ghost btn--small" onClick={pick}>
              Choose another
            </button>
          </div>
        </div>
      )}
      {result && (
        <>
          <div className="fi">
            <span className="fi__label">Caption</span>
            <div className="quicklabels">
              {CAPTION_CHIPS.map((c) => (
                <button key={c} type="button" className={`qchip ${caption === c ? 'is-on' : ''}`} onClick={() => setCaption(caption === c ? '' : c)}>
                  {c}
                </button>
              ))}
            </div>
            <input className="input" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Or describe what it shows" aria-label="Caption" />
          </div>
          <button className="btn btn--primary btn--block" onClick={upload} disabled={busy}>
            {busy ? 'Uploading…' : about ? `Attach to ${about.label.length > 28 ? about.label.slice(0, 28) + '…' : about.label}` : 'Save to library'}
          </button>
        </>
      )}
      {annotating && file && (
        <Suspense fallback={null}>
        <Annotator
          file={file}
          onCancel={() => setAnnotating(false)}
          onDone={(img) => {
            setResult(img)
            setAnnotating(false)
          }}
        />
        </Suspense>
      )}
    </div>
  )
}

export { imageUrl }
