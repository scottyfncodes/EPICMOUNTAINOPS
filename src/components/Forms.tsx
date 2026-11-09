import { useId, useMemo, useState, type ReactNode } from 'react'
import type { Callout, CalloutKind, DepartmentSection, Entity, EntityRef, EntityType, Source, Status } from '../../shared/types'
import { verificationProblem } from '../../shared/validate'
import { STATUSES } from '../../shared/types'
import { ACCENTS, newId, NODE_META, STATUS_META, TYPE_META } from '../lib/meta'
import { useAtlas } from '../lib/store'
import { Icon } from './Icon'
import { ImageAttach, ImageGallery } from './Images'
import { StatusGlyph, typeIcon } from './ui'

export type FieldDef =
  | { key: string; label: string; kind: 'text' | 'textarea'; help?: string; placeholder?: string; required?: boolean; rows?: number }
  | { key: string; label: string; kind: 'select'; options: { value: string; label: string }[]; help?: string }
  | { key: string; label: string; kind: 'status'; help?: string }
  | { key: string; label: string; kind: 'refs'; types: EntityType[]; help?: string; single?: boolean }
  | { key: string; label: string; kind: 'list'; help?: string; placeholder?: string }
  | { key: string; label: string; kind: 'images'; help?: string }
  | { key: string; label: string; kind: 'checkbox'; help?: string }
  | { key: string; label: string; kind: 'date'; help?: string }
  | { key: string; label: string; kind: 'sections'; help?: string }
  | { key: string; label: string; kind: 'links'; help?: string }
  | { key: string; label: string; kind: 'callouts'; help?: string }
  | { kind: 'heading'; label: string; key?: undefined }

/* ------------------------------------------------------------------ */
/* Schemas                                                            */
/* ------------------------------------------------------------------ */
const statusField: FieldDef = {
  key: 'status',
  label: 'Verification status',
  kind: 'status',
  help: 'Only mark Verified when confirmed against an authorized source — add that source below.',
}
const provenance: FieldDef[] = [
  { kind: 'heading', label: 'Provenance' },
  statusField,
  { key: 'source', label: 'Source / reference', kind: 'text', placeholder: 'e.g. Shown by shop lead during training, Nov 2' },
  { key: 'sourceIds', label: 'Linked sources', kind: 'refs', types: ['source'] },
  { key: 'notes', label: 'Notes', kind: 'textarea' },
  { key: 'imageIds', label: 'Screenshots & reference images', kind: 'images' },
  { key: 'illustrative', label: 'Illustrative / placeholder content', kind: 'checkbox', help: 'Shows a warning banner. Untick once this reflects reality.' },
]

const opt = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }))

export const SCHEMAS: Record<EntityType, FieldDef[]> = {
  department: [
    { key: 'title', label: 'Department name', kind: 'text', required: true },
    { key: 'code', label: 'Short code', kind: 'text', placeholder: 'e.g. SKI' },
    { key: 'tagline', label: 'Tagline', kind: 'text' },
    { key: 'accent', label: 'Accent colour', kind: 'select', options: Object.entries(ACCENTS).map(([value, a]) => ({ value, label: a.label })) },
    { key: 'emblem', label: 'Emblem', kind: 'select', options: opt({ '': 'Automatic', ski: 'Crossed skis', snb: 'Snowboard', jrt: 'Workshop tools', none: 'None' }) },
    { key: 'summary', label: 'Summary', kind: 'textarea', rows: 2 },
    { key: 'description', label: 'Description', kind: 'textarea' },
    { key: 'sections', label: 'Sections', kind: 'sections', help: 'Organizing categories and the workflows in each.' },
    { key: 'responsibilities', label: 'Responsibilities', kind: 'list' },
    { key: 'systemIds', label: 'Systems used', kind: 'refs', types: ['system'] },
    { key: 'equipmentIds', label: 'Tools & equipment', kind: 'refs', types: ['equipment'] },
    ...provenance,
  ],
  workflow: [
    { key: 'title', label: 'Workflow title', kind: 'text', required: true },
    { key: 'code', label: 'Code', kind: 'text', placeholder: 'e.g. SKI-06' },
    { key: 'summary', label: 'Summary', kind: 'textarea', rows: 2 },
    { key: 'trigger', label: 'Starts when…', kind: 'text' },
    { key: 'outcome', label: 'Finished when…', kind: 'text' },
    { key: 'departmentIds', label: 'Departments', kind: 'refs', types: ['department'] },
    { key: 'systemIds', label: 'Systems & programs', kind: 'refs', types: ['system'] },
    { key: 'equipmentIds', label: 'Equipment', kind: 'refs', types: ['equipment'] },
    ...provenance,
  ],
  system: [
    { key: 'title', label: 'Name', kind: 'text', required: true, help: 'Use the real name only once confirmed. Otherwise describe it, e.g. “Reservation lookup (name TBD)”.' },
    { key: 'kind', label: 'Type', kind: 'select', options: opt({ software: 'Software platform', program: 'Internal program', tool: 'Tool', reference: 'Reference / chart', process: 'Operational process' }) },
    { key: 'summary', label: 'One-line description', kind: 'text' },
    { key: 'description', label: 'Description', kind: 'textarea' },
    { key: 'purpose', label: 'Purpose', kind: 'textarea', rows: 2 },
    { key: 'departmentIds', label: 'Departments using it', kind: 'refs', types: ['department'] },
    { key: 'inputs', label: 'Information that goes in', kind: 'list' },
    { key: 'outputs', label: 'Information that comes out', kind: 'list' },
    { key: 'whenUsed', label: 'When it is used', kind: 'textarea', rows: 2 },
    ...provenance,
  ],
  equipment: [
    { key: 'title', label: 'Name', kind: 'text', required: true },
    { key: 'category', label: 'Category', kind: 'text' },
    { key: 'summary', label: 'One-line description', kind: 'text' },
    { key: 'description', label: 'Description', kind: 'textarea' },
    { key: 'departmentIds', label: 'Departments', kind: 'refs', types: ['department'] },
    { key: 'systemIds', label: 'Related systems', kind: 'refs', types: ['system'] },
    ...provenance,
  ],
  glossary: [
    { key: 'title', label: 'Term', kind: 'text', required: true },
    { key: 'kind', label: 'Kind', kind: 'select', options: opt({ acronym: 'Acronym', equipment: 'Equipment', department: 'Department language', software: 'Software', process: 'Process', general: 'General' }) },
    { key: 'definition', label: 'Definition', kind: 'textarea', required: true },
    { key: 'aka', label: 'Also known as', kind: 'list', help: 'Alternate spellings or expansions — these are linked and searchable too.' },
    { key: 'departmentIds', label: 'Departments', kind: 'refs', types: ['department'] },
    { key: 'systemIds', label: 'Related systems', kind: 'refs', types: ['system'] },
    { key: 'workflowIds', label: 'Related workflows', kind: 'refs', types: ['workflow'] },
    ...provenance,
  ],
  note: [
    { key: 'kind', label: 'Type', kind: 'select', options: opt({ observation: 'Observation', question: 'Question needing clarification' }) },
    { key: 'title', label: 'Headline', kind: 'text', required: true },
    { key: 'body', label: 'Details', kind: 'textarea' },
    { key: 'links', label: 'About', kind: 'links', help: 'What this observation or question relates to.' },
    { key: 'resolved', label: 'Resolved', kind: 'checkbox' },
    { key: 'answer', label: 'Answer / outcome', kind: 'textarea' },
    ...provenance,
  ],
  source: [
    { key: 'title', label: 'Source name', kind: 'text', required: true },
    { key: 'kind', label: 'Type', kind: 'select', options: opt({ document: 'Document', training: 'Training session', demonstration: 'Demonstration', verbal: 'Verbal instruction', screenshot: 'Screenshot', firsthand: 'First-hand experience', other: 'Other' }) },
    { key: 'authorized', label: 'Authorized source', kind: 'checkbox', help: 'An official procedure or material you are authorized to use.' },
    { key: 'date', label: 'Date', kind: 'date' },
    { key: 'url', label: 'Link', kind: 'text', placeholder: 'https://…', help: 'For public pages or documents.' },
    { key: 'description', label: 'Description', kind: 'textarea' },
    statusField,
    { key: 'notes', label: 'Notes', kind: 'textarea' },
    { key: 'imageIds', label: 'Images', kind: 'images' },
  ],
}

export const NODE_SCHEMA: FieldDef[] = [
  { key: 'label', label: '1 · Step name', kind: 'text', required: true },
  { key: 'kind', label: 'Shape', kind: 'select', options: Object.entries(NODE_META).map(([value, m]) => ({ value, label: `${m.label} — ${m.help}` })) },
  { key: 'linkWorkflowId', label: 'Hands off to workflow', kind: 'refs', types: ['workflow'], single: true },
  { key: 'embed', label: 'Show the linked workflow inline in the field guide', kind: 'checkbox', help: 'For shared sub-procedures used from several places.' },
  { key: 'status', label: 'Verification status', kind: 'status' },
  { key: 'phase', label: 'Stage', kind: 'text', placeholder: 'e.g. Boot fitting', help: 'Steps with the same stage are grouped, numbered and tracked in the field guide.' },
  { key: 'critical', label: 'Safety-critical step', kind: 'checkbox', help: 'Marked in red everywhere. Describe only what authorized procedures allow.' },
  { key: 'what', label: '2 · What happens', kind: 'textarea' },
  { key: 'why', label: '3 · Why it happens', kind: 'textarea', rows: 2 },
  { key: 'who', label: '4 · Who is responsible', kind: 'text' },
  { key: 'systemIds', label: '5 · Systems involved', kind: 'refs', types: ['system'] },
  { key: 'equipmentIds', label: '5 · Equipment involved', kind: 'refs', types: ['equipment'] },
  { key: 'info', label: '6 · Information required', kind: 'textarea', rows: 2 },
  { key: 'next', label: '7 · What happens next (notes)', kind: 'textarea', rows: 2, help: 'Connections drawn on the map are listed automatically.' },
  { key: 'mistakes', label: '8 · Common mistakes', kind: 'textarea', rows: 2 },
  { key: 'considerations', label: '9 · Important considerations', kind: 'textarea', rows: 2 },
  { key: 'callouts', label: 'Tips & labelled notes', kind: 'callouts', help: 'Each note says where it comes from: a pro tip, an employee-reported figure, published policy, or a safety reminder.' },
  { key: 'relatedWorkflowIds', label: '10 · Related workflows', kind: 'refs', types: ['workflow'] },
  { key: 'imageIds', label: '11 · Reference screenshots', kind: 'images' },
]

/* ------------------------------------------------------------------ */
/* Field engine                                                       */
/* ------------------------------------------------------------------ */
export function FormFields({
  schema,
  value,
  onChange,
  hide = [],
}: {
  schema: FieldDef[]
  value: Record<string, any>
  onChange: (patch: Record<string, any>) => void
  hide?: string[]
}) {
  return (
    <div className="form">
      {schema.map((f, i) => {
        if (f.kind === 'heading') return <h3 key={`h${i}`} className="form__heading">{f.label}</h3>
        if (hide.includes(f.key)) return null
        return <FieldInput key={f.key} def={f} value={value[f.key]} onChange={(v) => onChange({ [f.key]: v })} />
      })}
    </div>
  )
}

function Wrap({ label, help, children, htmlFor, required }: { label: string; help?: string; children: ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <div className="fi">
      <label className="fi__label" htmlFor={htmlFor}>
        {label}
        {required && <span className="fi__req"> required</span>}
      </label>
      {children}
      {help && <div className="fi__help">{help}</div>}
    </div>
  )
}

function FieldInput({ def, value, onChange }: { def: Exclude<FieldDef, { kind: 'heading' }>; value: any; onChange: (v: any) => void }) {
  const id = useId()
  switch (def.kind) {
    case 'text':
      return (
        <Wrap label={def.label} help={def.help} htmlFor={id} required={def.required}>
          <input id={id} className="input" value={value ?? ''} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
        </Wrap>
      )
    case 'textarea':
      return (
        <Wrap label={def.label} help={def.help} htmlFor={id} required={def.required}>
          <textarea id={id} className="input" rows={def.rows ?? 4} value={value ?? ''} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
        </Wrap>
      )
    case 'date':
      return (
        <Wrap label={def.label} help={def.help} htmlFor={id}>
          <input id={id} type="date" className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
        </Wrap>
      )
    case 'select':
      return (
        <Wrap label={def.label} help={def.help} htmlFor={id}>
          <select id={id} className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
            {def.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Wrap>
      )
    case 'checkbox':
      return (
        <label className="check">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          <span>
            {def.label}
            {def.help && <small>{def.help}</small>}
          </span>
        </label>
      )
    case 'status':
      return (
        <Wrap label={def.label} help={def.help}>
          <div className="seg" role="radiogroup" aria-label={def.label}>
            {STATUSES.map((s: Status) => (
              <button
                type="button"
                key={s}
                role="radio"
                aria-checked={value === s}
                className={`seg__opt status--${s} ${value === s ? 'is-on' : ''}`}
                onClick={() => onChange(s)}
                title={STATUS_META[s].help}
              >
                <StatusGlyph status={s} />
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </Wrap>
      )
    case 'list':
      return (
        <Wrap label={def.label} help={def.help}>
          <ListInput value={value || []} onChange={onChange} placeholder={def.placeholder} />
        </Wrap>
      )
    case 'refs':
      return (
        <Wrap label={def.label} help={def.help}>
          <RefPicker
            types={def.types}
            value={def.single ? (value ? [value] : []) : value || []}
            single={def.single}
            onChange={(ids) => onChange(def.single ? ids[0] : ids)}
          />
        </Wrap>
      )
    case 'images':
      return (
        <Wrap label={def.label} help={def.help}>
          <ImageGallery ids={value} onRemove={(rid) => onChange((value || []).filter((x: string) => x !== rid))} />
          <ImageAttach onAttach={(img) => onChange([...(value || []).filter((x: string) => x !== img), img])} />
        </Wrap>
      )
    case 'sections':
      return (
        <Wrap label={def.label} help={def.help}>
          <SectionsInput value={value || []} onChange={onChange} />
        </Wrap>
      )
    case 'links':
      return (
        <Wrap label={def.label} help={def.help}>
          <LinksInput value={value || []} onChange={onChange} />
        </Wrap>
      )
    case 'callouts':
      return (
        <Wrap label={def.label} help={def.help}>
          <CalloutsInput value={value || []} onChange={onChange} />
        </Wrap>
      )
  }
}

const CALLOUT_OPTIONS: { value: CalloutKind; label: string }[] = [
  { value: 'tip', label: 'Pro tip (field note)' },
  { value: 'estimate', label: 'Employee-reported figure (unverified)' },
  { value: 'published', label: 'Published policy (confirm before quoting)' },
  { value: 'safety', label: 'Safety-critical reminder' },
]

function CalloutsInput({ value, onChange }: { value: Callout[]; onChange: (v: Callout[]) => void }) {
  const set = (i: number, patch: Partial<Callout>) => onChange(value.map((c, k) => (k === i ? { ...c, ...patch } : c)))
  return (
    <div className="calloutsin">
      {value.map((c, i) => (
        <fieldset key={i} className="calloutsin__row">
          <legend className="sr-only">Note {i + 1}</legend>
          <div className="calloutsin__top">
            <select className="input" value={c.kind} onChange={(e) => set(i, { kind: e.target.value as CalloutKind })} aria-label={`Note ${i + 1} type`}>
              {CALLOUT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button type="button" className="iconbtn" onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label={`Remove note ${i + 1}`}>
              <Icon name="close" size={16} />
            </button>
          </div>
          <textarea className="input" rows={2} value={c.text} onChange={(e) => set(i, { text: e.target.value })} aria-label={`Note ${i + 1} text`} />
          <input
            className="input"
            inputMode="url"
            placeholder="Optional link — https://…"
            value={c.url ?? ''}
            onChange={(e) => set(i, { url: e.target.value || undefined })}
            aria-label={`Note ${i + 1} link`}
          />
        </fieldset>
      ))}
      <button type="button" className="btn btn--ghost" onClick={() => onChange([...value, { kind: 'tip', text: '' }])}>
        <Icon name="plus" size={16} /> Add a note
      </button>
    </div>
  )
}

function ListInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const t = draft.trim()
    if (!t) return
    onChange([...value, t])
    setDraft('')
  }
  return (
    <div className="listin">
      {value.map((v, i) => (
        <div key={i} className="listin__row">
          <input className="input" value={v} onChange={(e) => onChange(value.map((x, k) => (k === i ? e.target.value : x)))} aria-label={`Item ${i + 1}`} />
          <button type="button" className="iconbtn" onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label="Remove item">
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
      <div className="listin__row">
        <input
          className="input"
          value={draft}
          placeholder={placeholder || 'Add an item'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          onBlur={add}
          aria-label="New item"
        />
        <button type="button" className="iconbtn" onClick={add} aria-label="Add item">
          <Icon name="plus" size={16} />
        </button>
      </div>
    </div>
  )
}

export function RefPicker({ types, value, onChange, single }: { types: EntityType[]; value: string[]; onChange: (ids: string[]) => void; single?: boolean }) {
  const atlas = useAtlas()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const options = useMemo(() => {
    const all = types.flatMap((t) => atlas.list(t))
    const ql = q.trim().toLowerCase()
    return all
      .filter((e) => !value.includes(e.id))
      .filter((e) => !ql || e.title.toLowerCase().includes(ql) || ('code' in e && String(e.code || '').toLowerCase().includes(ql)))
      .slice(0, 30)
  }, [atlas, types, q, value])

  return (
    <div className="refpick">
      {value.length > 0 && (
        <div className="chips">
          {value.map((id) => {
            const e = atlas.get(id)
            return (
              <span key={id} className={`chip chip--${e?.type ?? 'missing'} chip--removable`}>
                {e && <Icon name={typeIcon(e.type)} size={14} />}
                <span>{e?.title ?? 'Missing item'}</span>
                <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} aria-label={`Remove ${e?.title ?? 'item'}`}>
                  <Icon name="close" size={12} />
                </button>
              </span>
            )
          })}
        </div>
      )}
      {(!single || value.length === 0) && (
        <div className="refpick__search">
          <input
            className="input"
            value={q}
            placeholder={`Link ${types.map((t) => TYPE_META[t].label.toLowerCase()).join(' / ')}…`}
            onChange={(e) => {
              setQ(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            aria-label={`Search ${types.join(', ')}`}
          />
          {open && (
            <ul className="refpick__menu" role="listbox">
              {options.length === 0 && <li className="refpick__none">No matches</li>}
              {options.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => {
                      onChange(single ? [e.id] : [...value, e.id])
                      setQ('')
                      setOpen(false)
                    }}
                  >
                    <Icon name={typeIcon(e.type)} size={14} />
                    {'code' in e && e.code ? <span className="chip__code">{e.code}</span> : null}
                    {e.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function SectionsInput({ value, onChange }: { value: DepartmentSection[]; onChange: (v: DepartmentSection[]) => void }) {
  const set = (i: number, patch: Partial<DepartmentSection>) => onChange(value.map((s, k) => (k === i ? { ...s, ...patch } : s)))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div className="sections-in">
      {value.map((s, i) => (
        <div key={s.id} className="sections-in__item">
          <div className="row gap-s">
            <input className="input" value={s.title} onChange={(e) => set(i, { title: e.target.value })} aria-label="Section title" />
            <button type="button" className="iconbtn" onClick={() => move(i, -1)} aria-label="Move up" disabled={i === 0}>
              <Icon name="down" size={16} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <button type="button" className="iconbtn" onClick={() => move(i, 1)} aria-label="Move down" disabled={i === value.length - 1}>
              <Icon name="down" size={16} />
            </button>
            <button
              type="button"
              className="iconbtn"
              onClick={() => {
                if (!s.workflowIds.length || confirm(`Remove the “${s.title}” section? Its workflows are not deleted.`)) onChange(value.filter((_, k) => k !== i))
              }}
              aria-label="Remove section"
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
          <input className="input" value={s.description || ''} placeholder="Short description (optional)" onChange={(e) => set(i, { description: e.target.value })} aria-label="Section description" />
          <RefPicker types={['workflow']} value={s.workflowIds} onChange={(ids) => set(i, { workflowIds: ids })} />
        </div>
      ))}
      <button type="button" className="btn btn--ghost" onClick={() => onChange([...value, { id: newId('sec'), title: 'New section', workflowIds: [] }])}>
        <Icon name="plus" size={16} /> Add section
      </button>
    </div>
  )
}

function LinksInput({ value, onChange }: { value: EntityRef[]; onChange: (v: EntityRef[]) => void }) {
  const atlas = useAtlas()
  return (
    <div className="links-in">
      <RefPicker
        types={['workflow', 'department', 'system', 'equipment', 'glossary']}
        value={value.map((r) => r.id)}
        onChange={(ids) =>
          onChange(
            ids
              .map((id) => value.find((r) => r.id === id) || (atlas.get(id) ? { type: atlas.get(id)!.type, id } : null))
              .filter(Boolean) as EntityRef[],
          )
        }
      />
      {value
        .filter((r) => r.type === 'workflow')
        .map((r) => {
          const w = atlas.get(r.id)
          if (!w || w.type !== 'workflow') return null
          return (
            <label key={r.id} className="fi fi--inline">
              <span className="fi__label">Step in “{w.title}” (optional)</span>
              <select
                className="input"
                value={r.nodeId || ''}
                onChange={(e) => onChange(value.map((x) => (x.id === r.id ? { ...x, nodeId: e.target.value || undefined } : x)))}
              >
                <option value="">Whole workflow</option>
                {w.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
            </label>
          )
        })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
export function validateEntity(e: Entity, lookupSource: (id: string) => Source | undefined = () => undefined): string | null {
  if (!e.title?.trim()) return 'Add a title first.'
  if (e.type === 'glossary' && !e.definition?.trim()) return 'Add a definition.'
  return verificationProblem(e, lookupSource)
}

export function blankEntity(type: EntityType, extra: Partial<Entity> = {}): Entity {
  const now = new Date().toISOString()
  const base = { id: '', title: '', status: 'unverified' as Status, createdAt: now, updatedAt: now }
  const byType: Record<EntityType, any> = {
    department: { code: '', accent: 'slate', sections: [], responsibilities: [], order: 99 },
    workflow: {
      departmentIds: [],
      systemIds: [],
      equipmentIds: [],
      nodes: [
        { id: 'start', kind: 'start', label: 'Start' },
        { id: 'first', kind: 'unknown', label: 'First step — describe it' },
      ],
      edges: [{ id: 'start->first', source: 'start', target: 'first', kind: 'normal' }],
    },
    system: { kind: 'software', departmentIds: [], inputs: [], outputs: [] },
    equipment: { departmentIds: [], systemIds: [] },
    glossary: { kind: 'general', definition: '', aka: [], departmentIds: [], systemIds: [], workflowIds: [] },
    note: { kind: 'observation', links: [], resolved: false, status: 'observed' },
    source: { kind: 'firsthand', authorized: false },
  }
  return { ...base, type, ...byType[type], ...extra } as Entity
}
