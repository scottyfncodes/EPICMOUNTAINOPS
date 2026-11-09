import type { BodyLandmark, Callout, CalloutKind, SizingBand } from '../../shared/types'
import { BODY_LANDMARKS, isSafeUrl } from '../../shared/validate'
import { Icon, type IconName } from '../components/Icon'
import { RichText } from '../components/ui'

/**
 * Provenance-labelled notes on a step. Each kind says where the information
 * comes from, so a pro tip never reads like policy and a published figure
 * never reads like a confirmed one.
 */
export const CALLOUT_META: Record<CalloutKind, { label: string; basis: string; icon: IconName; help: string }> = {
  tip: { label: 'Pro tip', basis: 'Field note', icon: 'eye', help: 'First-hand advice from someone who does the job.' },
  estimate: { label: 'Employee-reported', basis: 'Unverified estimate', icon: 'question', help: 'A figure reported on the floor. Confirm before quoting.' },
  published: { label: 'Published policy', basis: 'Confirm before quoting', icon: 'book', help: 'Stated on an official public page. Terms can change.' },
  safety: { label: 'Safety-critical', basis: 'Approved procedures only', icon: 'warning', help: 'Follow current approved procedures.' },
}

export function Callouts({ items }: { items?: Callout[] }) {
  if (!items?.length) return null
  return (
    <div className="callouts">
      {items.map((c, i) => {
        const m = CALLOUT_META[c.kind] ?? CALLOUT_META.tip
        const link = c.url && isSafeUrl(c.url) ? c.url : undefined
        return (
          <aside key={i} className={`callout callout--${c.kind}`} aria-label={`${m.label} — ${m.basis}`}>
            <div className="callout__tag" title={m.help}>
              <Icon name={m.icon} size={13} />
              <b>{m.label}</b>
              <span aria-hidden="true">·</span>
              <span>{m.basis}</span>
            </div>
            <RichText text={c.text} />
            {link && (
              <a className="callout__link" href={link} target="_blank" rel="noopener noreferrer">
                {c.urlLabel || new URL(link).hostname}
                <Icon name="external" size={13} />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
          </aside>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Visual sizing reference                                             */
/* ------------------------------------------------------------------ */
/** Landmark heights in "head heights" below the top of the head (child proportions, simplified). */
const HEAD = 84
const TOP = 14
const at = (f: number) => Math.round(TOP + f * HEAD)
const LANDMARK: Record<BodyLandmark, { y: number; label: string }> = {
  top: { y: at(0), label: 'Top of head' },
  forehead: { y: at(0.2), label: 'Forehead' },
  eyes: { y: at(0.42), label: 'Eyes' },
  nose: { y: at(0.56), label: 'Nose' },
  chin: { y: at(1), label: 'Chin' },
  collarbone: { y: at(1.45), label: 'Collarbone' },
  chest: { y: at(1.9), label: 'Chest' },
}
const FIG_X = 118
const RULER_X = 182

/** Bands that overlap go in separate columns; adjacent bands share one. */
function columns(bands: SizingBand[]) {
  const cols: SizingBand[][] = []
  const rank = (l: BodyLandmark) => BODY_LANDMARKS.indexOf(l)
  for (const b of bands) {
    const free = cols.find((c) => c.every((o) => rank(b.to) <= rank(o.from) || rank(b.from) >= rank(o.to)))
    if (free) free.push(b)
    else cols.push([b])
  }
  return cols
}

export function SizingFigure({ bands, caption }: { bands?: SizingBand[]; caption?: string }) {
  if (!bands?.length) return null
  const used = new Set(bands.flatMap((b) => [b.from, b.to]))
  const marks = BODY_LANDMARKS.filter((l) => used.has(l))
  const cols = columns(bands)
  const lowest = Math.max(...marks.map((m) => LANDMARK[m].y))
  const height = Math.max(lowest + 22, at(1.45) + 22)
  const summary = bands.map((b) => `${b.label}: ${LANDMARK[b.from].label.toLowerCase()} to ${LANDMARK[b.to].label.toLowerCase()}`).join('; ')
  return (
    <figure className="sizing">
      <svg viewBox={`0 0 340 ${height}`} role="img" aria-label={`Ski tip height by ability. ${summary}.`} className="sizing__svg">
        {/* landmark guides */}
        {marks.map((m) => (
          <g key={m} className="sizing__mark">
            <line x1={74} x2={RULER_X + cols.length * 18 - 4} y1={LANDMARK[m].y} y2={LANDMARK[m].y} />
            <text x={0} y={LANDMARK[m].y + 3.5}>
              {LANDMARK[m].label}
            </text>
          </g>
        ))}
        {/* figure: head and shoulders, front view */}
        <g className="sizing__figure" aria-hidden="true">
          <ellipse cx={FIG_X} cy={TOP + HEAD / 2} rx={29} ry={HEAD / 2} />
          <path d={`M${FIG_X} ${at(0.45)} q -5 ${at(0.56) - at(0.45) - 2} 1 ${at(0.56) - at(0.45)}`} />
          <path d={`M${FIG_X - 10} ${at(0.97)} v14 c0 8 -12 11 -28 16 c-14 5 -20 13 -21 ${height - at(0.97) - 30}`} />
          <path d={`M${FIG_X + 10} ${at(0.97)} v14 c0 8 12 11 28 16 c14 5 20 13 21 ${height - at(0.97) - 30}`} />
          <path d={`M${FIG_X - 30} ${at(1.43)} q 13 5 24 1 M${FIG_X + 30} ${at(1.43)} q -13 5 -24 1`} className="sizing__clav" />
        </g>
        {/* bands: where the ski tip should reach */}
        {cols.map((col, ci) =>
          col.map((b) => {
            const i = bands.indexOf(b)
            const y1 = LANDMARK[b.to].y
            const y2 = LANDMARK[b.from].y
            const x = RULER_X + ci * 18
            const lx = RULER_X + cols.length * 18 + 4
            return (
              <g key={b.label} className={`sizing__band sizing__band--${i % 4}`}>
                <rect x={x} y={y1 + 1.5} width={12} height={y2 - y1 - 3} rx={6} />
                <text x={lx} y={(y1 + y2) / 2 - 1} className="sizing__label">
                  {b.label}
                </text>
                <text x={lx} y={(y1 + y2) / 2 + 11} className="sizing__range">
                  {LANDMARK[b.from].label.toLowerCase()} → {LANDMARK[b.to].label.toLowerCase()}
                </text>
              </g>
            )
          }),
        )}
      </svg>
      <figcaption className="sizing__cap">{caption || 'Where the ski tip should reach, standing beside the skier.'}</figcaption>
    </figure>
  )
}
