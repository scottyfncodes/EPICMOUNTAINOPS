import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

/**
 * Touch-first screenshot annotator. Everything is baked into a new image on
 * export; the unedited original never leaves the device, so redactions are real.
 */
export type Tool = 'arrow' | 'box' | 'highlight' | 'number' | 'redact' | 'crop'

type Pt = { x: number; y: number }
export type Shape =
  | { t: 'arrow' | 'box' | 'highlight' | 'redact'; a: Pt; b: Pt; color: string }
  | { t: 'number'; a: Pt; n: number; color: string }

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: 'arrow', label: 'Arrow', icon: 'arrowRight' },
  { id: 'box', label: 'Box', icon: 'minimap' },
  { id: 'highlight', label: 'Highlight', icon: 'edit' },
  { id: 'number', label: 'Number', icon: 'dot' },
  { id: 'redact', label: 'Redact', icon: 'eye' },
  { id: 'crop', label: 'Crop', icon: 'fit' },
]
const COLORS = ['#e8742a', '#8db3c7', '#f3efe6', '#7fa88c']
const MAX_EDGE = 2000

export interface AnnotatedImage {
  dataUrl: string
  width: number
  height: number
}

function loadFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file could not be read as an image.'))
    }
    img.src = url
  })
}

/** Draw shapes onto a 2D context in image coordinates. Exported for tests. */
export function drawShapes(ctx: CanvasRenderingContext2D, shapes: Shape[], scale: number) {
  const lw = Math.max(4, 9 * scale)
  for (const s of shapes) {
    ctx.save()
    if (s.t === 'redact') {
      ctx.fillStyle = '#111417'
      ctx.fillRect(Math.min(s.a.x, s.b.x), Math.min(s.a.y, s.b.y), Math.abs(s.b.x - s.a.x), Math.abs(s.b.y - s.a.y))
    } else if (s.t === 'highlight') {
      ctx.fillStyle = 'rgba(255, 214, 10, 0.38)'
      ctx.fillRect(Math.min(s.a.x, s.b.x), Math.min(s.a.y, s.b.y), Math.abs(s.b.x - s.a.x), Math.abs(s.b.y - s.a.y))
    } else if (s.t === 'box') {
      ctx.strokeStyle = s.color
      ctx.lineWidth = lw
      ctx.lineJoin = 'round'
      ctx.strokeRect(Math.min(s.a.x, s.b.x), Math.min(s.a.y, s.b.y), Math.abs(s.b.x - s.a.x), Math.abs(s.b.y - s.a.y))
    } else if (s.t === 'arrow') {
      const ang = Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x)
      const head = Math.max(24, 40 * scale)
      ctx.strokeStyle = s.color
      ctx.fillStyle = s.color
      ctx.lineWidth = lw
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(s.a.x, s.a.y)
      ctx.lineTo(s.b.x - Math.cos(ang) * head * 0.6, s.b.y - Math.sin(ang) * head * 0.6)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(s.b.x, s.b.y)
      ctx.lineTo(s.b.x - head * Math.cos(ang - 0.45), s.b.y - head * Math.sin(ang - 0.45))
      ctx.lineTo(s.b.x - head * Math.cos(ang + 0.45), s.b.y - head * Math.sin(ang + 0.45))
      ctx.closePath()
      ctx.fill()
    } else if (s.t === 'number') {
      const r = Math.max(22, 34 * scale)
      ctx.fillStyle = s.color
      ctx.beginPath()
      ctx.arc(s.a.x, s.a.y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = Math.max(2, 2.5 * scale)
      ctx.strokeStyle = '#14181b'
      ctx.stroke()
      ctx.fillStyle = '#14181b'
      ctx.font = `700 ${Math.round(r * 1.1)}px Archivo, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(s.n), s.a.x, s.a.y + r * 0.05)
    }
    ctx.restore()
  }
}

export function Annotator({ file, onDone, onCancel }: { file: File; onDone: (img: AnnotatedImage) => void; onCancel: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const base = useRef<HTMLCanvasElement | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('arrow')
  const [color, setColor] = useState(COLORS[0])
  const [shapes, setShapes] = useState<Shape[]>([])
  const [draft, setDraft] = useState<Shape | null>(null)
  const [crop, setCrop] = useState<{ a: Pt; b: Pt } | null>(null)
  const [cropDraft, setCropDraft] = useState<{ a: Pt; b: Pt } | null>(null)
  const start = useRef<Pt | null>(null)
  const scale = useRef(1)

  // Load and downscale once.
  useEffect(() => {
    let alive = true
    loadFile(file)
      .then((img) => {
        if (!alive) return
        const k = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
        const w = Math.max(1, Math.round(img.naturalWidth * k))
        const h = Math.max(1, Math.round(img.naturalHeight * k))
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const ctx = c.getContext('2d')!
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        base.current = c
        scale.current = Math.max(w, h) / 1200
        setReady(true)
      })
      .catch((e) => setError(e.message))
    return () => {
      alive = false
    }
  }, [file])

  const render = useCallback(() => {
    const c = canvas.current
    const b = base.current
    if (!c || !b) return
    c.width = b.width
    c.height = b.height
    const ctx = c.getContext('2d')!
    ctx.drawImage(b, 0, 0)
    drawShapes(ctx, draft ? [...shapes, draft] : shapes, scale.current)
    const cr = cropDraft || crop
    if (cr) {
      const x = Math.min(cr.a.x, cr.b.x)
      const y = Math.min(cr.a.y, cr.b.y)
      const w = Math.abs(cr.b.x - cr.a.x)
      const h = Math.abs(cr.b.y - cr.a.y)
      ctx.save()
      ctx.fillStyle = 'rgba(8, 10, 12, 0.6)'
      ctx.fillRect(0, 0, c.width, y)
      ctx.fillRect(0, y + h, c.width, c.height - y - h)
      ctx.fillRect(0, y, x, h)
      ctx.fillRect(x + w, y, c.width - x - w, h)
      ctx.strokeStyle = '#f3efe6'
      ctx.setLineDash([12 * scale.current, 8 * scale.current])
      ctx.lineWidth = 3 * scale.current
      ctx.strokeRect(x, y, w, h)
      ctx.restore()
    }
  }, [shapes, draft, crop, cropDraft])

  useEffect(() => {
    if (ready) render()
  }, [ready, render])

  const toImage = (e: React.PointerEvent): Pt => {
    const c = canvas.current!
    const r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height }
  }

  const onDown = (e: React.PointerEvent) => {
    if (!ready) return
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const p = toImage(e)
    if (tool === 'number') {
      const n = shapes.filter((s) => s.t === 'number').length + 1
      setShapes((s) => [...s, { t: 'number', a: p, n, color }])
      return
    }
    start.current = p
    if (tool === 'crop') setCropDraft({ a: p, b: p })
    else setDraft({ t: tool, a: p, b: p, color } as Shape)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return
    const p = toImage(e)
    if (tool === 'crop') setCropDraft({ a: start.current, b: p })
    else setDraft((d) => (d && d.t !== 'number' ? { ...d, b: p } : d))
  }
  const onUp = () => {
    if (!start.current) return
    start.current = null
    const big = (a: Pt, b: Pt) => Math.abs(a.x - b.x) > 8 * scale.current && Math.abs(a.y - b.y) > 8 * scale.current
    if (tool === 'crop') {
      if (cropDraft && big(cropDraft.a, cropDraft.b)) setCrop(cropDraft)
      setCropDraft(null)
      return
    }
    if (draft && draft.t !== 'number') {
      const longEnough = draft.t === 'arrow' ? Math.hypot(draft.b.x - draft.a.x, draft.b.y - draft.a.y) > 12 * scale.current : big(draft.a, draft.b)
      if (longEnough) setShapes((s) => [...s, draft])
    }
    setDraft(null)
  }

  const exportImage = () => {
    const b = base.current
    if (!b) return
    const full = document.createElement('canvas')
    full.width = b.width
    full.height = b.height
    const fctx = full.getContext('2d')!
    fctx.drawImage(b, 0, 0)
    drawShapes(fctx, shapes, scale.current)
    let out = full
    if (crop) {
      const x = Math.round(Math.max(0, Math.min(crop.a.x, crop.b.x)))
      const y = Math.round(Math.max(0, Math.min(crop.a.y, crop.b.y)))
      const w = Math.round(Math.min(b.width - x, Math.abs(crop.b.x - crop.a.x)))
      const h = Math.round(Math.min(b.height - y, Math.abs(crop.b.y - crop.a.y)))
      out = document.createElement('canvas')
      out.width = w
      out.height = h
      out.getContext('2d')!.drawImage(full, x, y, w, h, 0, 0, w, h)
    }
    let dataUrl = out.toDataURL('image/webp', 0.86)
    if (!dataUrl.startsWith('data:image/webp')) dataUrl = out.toDataURL('image/jpeg', 0.86)
    let q = 0.8
    while (dataUrl.length > 3_600_000 && q > 0.4) {
      dataUrl = out.toDataURL('image/jpeg', q)
      q -= 0.15
    }
    onDone({ dataUrl, width: out.width, height: out.height })
  }

  const redactions = shapes.filter((s) => s.t === 'redact').length

  return createPortal(
    <div className="annot" role="dialog" aria-modal="true" aria-label="Annotate screenshot">
      <header className="annot__bar">
        <button className="btn btn--ghost btn--small" onClick={onCancel}>
          Cancel
        </button>
        <span className="annot__title">Mark up</span>
        <button className="btn btn--primary btn--small" onClick={exportImage} disabled={!ready}>
          Use image
        </button>
      </header>
      <div className="annot__stage">
        {error && <p className="error-text">{error}</p>}
        {!ready && !error && <div className="loading__ridge" aria-label="Loading image" />}
        <canvas
          ref={canvas}
          className={`annot__canvas tool--${tool}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label={`Screenshot. Drag to add ${tool}.`}
          data-marks={shapes.length}
          style={{ visibility: ready ? 'visible' : 'hidden' }}
        />
      </div>
      <div className="annot__tools">
        <div className="annot__row" role="radiogroup" aria-label="Annotation tool">
          {TOOLS.map((t) => (
            <button key={t.id} role="radio" aria-checked={tool === t.id} className={`annot__tool ${tool === t.id ? 'is-on' : ''}`} onClick={() => setTool(t.id)}>
              <Icon name={t.icon} size={18} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="annot__row annot__row--sub">
          <div className="annot__colors" role="radiogroup" aria-label="Colour">
            {COLORS.map((c) => (
              <button key={c} role="radio" aria-checked={color === c} aria-label={`Colour ${c}`} className={`annot__swatch ${color === c ? 'is-on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
          <span className="grow" />
          {crop && (
            <button className="btn btn--ghost btn--small" onClick={() => setCrop(null)}>
              Reset crop
            </button>
          )}
          <button className="iconbtn iconbtn--lg" onClick={() => setShapes((s) => s.slice(0, -1))} disabled={!shapes.length} aria-label="Undo last mark">
            <Icon name="undo" />
          </button>
        </div>
        <p className="annot__note">
          {redactions > 0 ? `${redactions} redaction${redactions > 1 ? 's' : ''} — permanent in the saved image. ` : 'Redact customer names, numbers or anything private. '}
          Only the marked-up copy is uploaded.
        </p>
      </div>
    </div>,
    document.body,
  )
}
