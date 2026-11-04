import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { api, imageUrl } from '../lib/api'
import { uploadImageFile } from '../lib/images'
import { hrefFor } from '../lib/meta'
import { useStore } from '../lib/store'
import { Icon } from './Icon'
import { Sheet } from './Sheet'

export function ImageGallery({ ids: rawIds, onRemove }: { ids?: string[]; onRemove?: (id: string) => void }) {
  const { atlas } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const ids = rawIds ? [...new Set(rawIds)] : rawIds // older records may list an image twice
  if (!ids?.length) return null
  return (
    <>
      <div className="gallery">
        {ids.map((id) => {
          const meta = atlas.images.get(id)
          return (
            <figure key={id} className="gallery__item">
              <button className="gallery__thumb" onClick={() => setOpen(id)} aria-label={`Open image${meta?.caption ? ': ' + meta.caption : ''}`}>
                <img src={imageUrl(id)} alt={meta?.caption || 'Reference image'} loading="lazy" decoding="async" />
              </button>
              {meta?.caption && <figcaption>{meta.caption}</figcaption>}
              {onRemove && (
                <button className="gallery__remove" onClick={() => onRemove(id)} aria-label="Detach image">
                  <Icon name="close" size={14} />
                </button>
              )}
            </figure>
          )
        })}
      </div>
      {open && <Lightbox id={open} ids={ids} onClose={() => setOpen(null)} onChange={setOpen} />}
    </>
  )
}

function Lightbox({ id, ids, onClose, onChange }: { id: string; ids: string[]; onClose: () => void; onChange: (id: string) => void }) {
  const { atlas, canEdit, toast, addImage } = useStore()
  const meta = atlas.images.get(id)
  const used = atlas.imagesUsedBy(id)
  const [zoom, setZoom] = useState(false)
  const [caption, setCaption] = useState(meta?.caption || '')
  const i = ids.indexOf(id)
  useEffect(() => setCaption(meta?.caption || ''), [meta?.caption])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && i < ids.length - 1) onChange(ids[i + 1])
      if (e.key === 'ArrowLeft' && i > 0) onChange(ids[i - 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [i, ids, onChange, onClose])

  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Image viewer">
      <div className="lightbox__bar">
        <span className="mono">{ids.length > 1 ? `${i + 1} / ${ids.length}` : 'Reference image'}</span>
        <div className="row gap-s">
          <a className="iconbtn" href={imageUrl(id)} target="_blank" rel="noreferrer" aria-label="Open original">
            <Icon name="external" />
          </a>
          <button className="iconbtn" onClick={onClose} aria-label="Close image">
            <Icon name="close" />
          </button>
        </div>
      </div>
      <div className={`lightbox__stage ${zoom ? 'is-zoomed' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <img src={imageUrl(id)} alt={meta?.caption || 'Reference image'} onClick={() => setZoom((z) => !z)} />
      </div>
      <div className="lightbox__foot">
        {canEdit ? (
          <form
            className="row gap-s"
            onSubmit={async (e) => {
              e.preventDefault()
              try {
                await api.captionImage(id, caption)
                if (meta) addImage({ ...meta, caption })
                toast('Caption saved')
              } catch (err) {
                toast((err as Error).message, 'error')
              }
            }}
          >
            <input className="input" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption" aria-label="Caption" />
            <button className="btn btn--ghost" type="submit">
              Save
            </button>
          </form>
        ) : (
          meta?.caption && <p>{meta.caption}</p>
        )}
        {used.length > 0 && (
          <div className="lightbox__used">
            Used in:{' '}
            {used.map((u, k) => (
              <Link key={k} to={hrefFor(u.entity, u.node?.id)} onClick={onClose}>
                {u.node ? `${u.entity.title} › ${u.node.label}` : u.entity.title}
              </Link>
            ))}
          </div>
        )}
        <div className="row gap-s lightbox__nav">
          <button className="btn btn--ghost" disabled={i <= 0} onClick={() => onChange(ids[i - 1])}>
            Previous
          </button>
          <button className="btn btn--ghost" disabled={i >= ids.length - 1} onClick={() => onChange(ids[i + 1])}>
            Next
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Upload a new image or pick one already in the library. */
export function ImageAttach({ onAttach, label = 'Add screenshot' }: { onAttach: (id: string) => void; label?: string }) {
  const { addImage, toast, atlas } = useStore()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [library, setLibrary] = useState(false)

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      for (const f of Array.from(files)) {
        const meta = await uploadImageFile(f)
        addImage(meta)
        onAttach(meta.id)
      }
      toast(files.length > 1 ? `${files.length} images attached` : 'Image attached')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="row gap-s wrap">
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      <button type="button" className="btn btn--ghost" onClick={() => input.current?.click()} disabled={busy}>
        <Icon name="camera" size={18} />
        {busy ? 'Uploading…' : label}
      </button>
      {atlas.imageList.length > 0 && (
        <button type="button" className="btn btn--ghost" onClick={() => setLibrary(true)}>
          <Icon name="image" size={18} />
          From library
        </button>
      )}
      <Sheet open={library} onClose={() => setLibrary(false)} title="Image library" modal size="full">
        <div className="gallery gallery--picker">
          {atlas.imageList.map((img) => (
            <figure key={img.id} className="gallery__item">
              <button
                className="gallery__thumb"
                onClick={() => {
                  onAttach(img.id)
                  setLibrary(false)
                }}
              >
                <img src={imageUrl(img.id)} alt={img.caption || 'Library image'} loading="lazy" />
              </button>
              {img.caption && <figcaption>{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      </Sheet>
    </div>
  )
}
