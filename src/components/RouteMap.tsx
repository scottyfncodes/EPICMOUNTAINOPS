import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Workflow } from '../../shared/types'
import { ACCENTS, hrefFor } from '../lib/meta'
import { buildRoutes, interchangeCount, type RouteLine, type Station } from '../lib/routes'
import { useAtlas } from '../lib/store'
import { Icon } from './Icon'
import { Emblem, StatusGlyph } from './ui'

/**
 * Transit-style map of the operation: one line per department, stations are
 * workflows, solid track = a hand-off exists, break = none mapped yet,
 * interchange chips = work crossing to another department.
 */
export function RouteMap({ departmentId, showHeader = true }: { departmentId?: string; showHeader?: boolean }) {
  const atlas = useAtlas()
  const lines = useMemo(() => buildRoutes(atlas.departments, atlas.list('workflow')), [atlas])
  const shown = departmentId ? lines.filter((l) => l.department.id === departmentId) : lines
  const crossings = interchangeCount(lines)

  return (
    <div className={`routemap ${departmentId ? 'routemap--single' : ''}`}>
      {showHeader && !departmentId && (
        <p className="routemap__legend">
          <span className="rk rk--track" /> hand-off mapped
          <span className="rk rk--gap" /> no hand-off yet
          <span className="rk rk--xfer" /> {crossings} cross-department hand-off{crossings === 1 ? '' : 's'}
        </p>
      )}
      <div className="routemap__lines">
        {shown.map((l) => (
          <Line key={l.department.id} line={l} withHeader={!departmentId} />
        ))}
      </div>
    </div>
  )
}

function Line({ line, withHeader }: { line: RouteLine; withHeader: boolean }) {
  const d = line.department
  const stations = line.segments.flat()
  const unknown = stations.reduce((n, s) => n + s.workflow.nodes.filter((x) => x.kind === 'unknown').length, 0)
  return (
    <section className="routeline" style={{ '--accent': ACCENTS[d.accent].color } as React.CSSProperties} aria-label={`${d.title} route`}>
      {withHeader && (
        <Link to={hrefFor(d)} className="routeline__head" viewTransition>
          <Emblem dept={d} size={30} />
          <span className="routeline__name">
            <span className="mono">{d.code}</span>
            <b>{d.title}</b>
          </span>
          <span className="routeline__meta">
            {stations.length} workflows{unknown ? ` · ${unknown} unknown steps` : ''}
          </span>
          <Icon name="chevron" size={16} />
        </Link>
      )}
      {stations.length === 0 ? (
        <p className="muted routeline__empty">No workflows on this line yet.</p>
      ) : (
        <ol className="route">
          {line.segments.map((seg, si) => (
            <Segment key={si} seg={seg} first={si === 0} />
          ))}
        </ol>
      )}
    </section>
  )
}

function Segment({ seg, first }: { seg: Station[]; first: boolean }) {
  return (
    <>
      {!first && (
        <li className="route__gap" aria-label="No hand-off mapped between these workflows">
          <span>no hand-off mapped</span>
        </li>
      )}
      {seg.map((s, i) => (
        <StationRow key={s.workflow.id} s={s} last={i === seg.length - 1} />
      ))}
    </>
  )
}

function XferChip({ w, dir }: { w: Workflow; dir: 'in' | 'out' }) {
  const atlas = useAtlas()
  const dept = atlas.get(w.departmentIds[0])
  const color = dept?.type === 'department' ? ACCENTS[dept.accent].color : 'var(--paper-dim)'
  return (
    <Link to={hrefFor(w)} className={`xfer xfer--${dir}`} style={{ '--xfer': color } as React.CSSProperties} viewTransition>
      <Icon name={dir === 'out' ? 'arrowRight' : 'back'} size={12} />
      <span className="mono">{w.code}</span>
      <span className="xfer__title">{dir === 'out' ? 'hands off to' : 'from'} {w.title}</span>
    </Link>
  )
}

function StationRow({ s, last }: { s: Station; last: boolean }) {
  const w = s.workflow
  const unknown = w.nodes.filter((n) => n.kind === 'unknown').length
  const warn = w.nodes.filter((n) => n.kind === 'warning').length
  const interchange = s.in.length + s.out.length > 0
  return (
    <li className={`station ${last ? 'station--end' : ''} ${interchange ? 'station--xfer' : ''}`}>
      <span className="station__dot" aria-hidden="true" />
      <div className="station__body">
        {s.in.map((x) => (
          <XferChip key={x.id} w={x} dir="in" />
        ))}
        <Link to={hrefFor(w)} className="station__link" viewTransition>
          <span className="station__code mono">{w.code}</span>
          <span className="station__title">{w.title}</span>
          <span className="station__meta">
            <span className={`status--${w.status}`} title={w.status}>
              <StatusGlyph status={w.status} size={11} />
            </span>
            {w.nodes.length} steps
            {warn > 0 && <span className="station__warn">· {warn} warning{warn > 1 ? 's' : ''}</span>}
            {unknown > 0 && <span className="station__unk">· {unknown} unknown</span>}
          </span>
        </Link>
        {s.out.map((x) => (
          <XferChip key={x.id} w={x} dir="out" />
        ))}
      </div>
    </li>
  )
}
