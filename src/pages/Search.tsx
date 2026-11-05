import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { StatusBadge } from '../components/ui'
import { buildIndex, KIND_LABEL, runSearch, snippet, type ResultKind, type SearchHit } from '../lib/search'
import { useAtlas } from '../lib/store'
import type { Status } from '../../shared/types'

const KIND_ICON: Record<ResultKind, string> = {
  department: 'peaks',
  section: 'layers',
  workflow: 'flow',
  step: 'flow',
  system: 'system',
  equipment: 'wrench',
  glossary: 'book',
  note: 'question',
  source: 'layers',
}

const ORDER: ResultKind[] = ['glossary', 'workflow', 'step', 'system', 'equipment', 'department', 'section', 'note', 'source']

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length || !text) return <>{text}</>
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts = text.split(re)
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}
    </>
  )
}

export function SearchPage() {
  const atlas = useAtlas()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const [kind, setKind] = useState<ResultKind | 'all'>('all')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const index = useMemo(() => buildIndex(atlas), [atlas])
  const hits = useMemo(() => runSearch(index, q), [index, q])
  const shown = kind === 'all' ? hits : hits.filter((h) => h.kind === kind)
  const counts = useMemo(() => hits.reduce<Record<string, number>>((a, h) => ((a[h.kind] = (a[h.kind] || 0) + 1), a), {}), [hits])

  useEffect(() => {
    input.current?.focus()
  }, [])
  useEffect(() => {
    const t = setTimeout(() => setParams(q ? { q } : {}, { replace: true }), 250)
    setActive(0)
    return () => clearTimeout(t)
  }, [q, setParams])

  const suggestions = atlas.list('glossary').slice(0, 6)

  return (
    <div className="page page--search">
      <h1 className="sr-only">Search the atlas</h1>
      <form
        className="searchbar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          if (shown[active]) navigate(shown[active].href)
        }}
      >
        <Icon name="search" size={20} />
        <input
          ref={input}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search everything — try “BSL”, “return”, “walk”"
          aria-label="Search everything"
          autoComplete="off"
          enterKeyHint="search"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(shown.length - 1, a + 1))
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(0, a - 1))
            }
          }}
        />
        {q && (
          <button type="button" className="iconbtn" onClick={() => setQ('')} aria-label="Clear search">
            <Icon name="close" size={18} />
          </button>
        )}
      </form>

      {q && hits.length > 0 && (
        <div className="pills pills--scroll" role="group" aria-label="Filter results by type">
          <button className={`pill ${kind === 'all' ? 'is-on' : ''}`} aria-pressed={kind === 'all'} onClick={() => setKind('all')}>
            All <span>{hits.length}</span>
          </button>
          {ORDER.filter((k) => counts[k]).map((k) => (
            <button key={k} className={`pill ${kind === k ? 'is-on' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {KIND_LABEL[k]} <span>{counts[k]}</span>
            </button>
          ))}
        </div>
      )}

      {!q && (
        <div className="search-empty">
          <p className="muted">Search covers departments, workflows, every individual step, systems, equipment, glossary terms and notes. Partial words and acronyms work.</p>
          <div className="kicker">Try a term</div>
          <div className="chips">
            {suggestions.map((g) => (
              <button key={g.id} className="chip chip--glossary" onClick={() => setQ(g.title)}>
                {g.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {q && shown.length === 0 && (
        <div className="search-empty">
          <p>
            No results for <b>“{q}”</b>.
          </p>
          <p className="muted">Unknown term? Add it to the glossary so it’s here next time.</p>
          <Link className="btn btn--ghost" to="/add/glossary">
            <Icon name="plus" size={16} /> Add glossary entry
          </Link>
        </div>
      )}

      <ol className="results" aria-live="polite">
        {shown.map((h: SearchHit, i) => (
          <li key={h.id}>
            <Link to={h.href} className={`result ${i === active ? 'is-active' : ''}`} viewTransition>
              <span className={`result__icon result__icon--${h.kind}`}>
                <Icon name={KIND_ICON[h.kind]} size={16} />
              </span>
              <span className="result__main">
                <span className="result__where">
                  {KIND_LABEL[h.kind]}
                  {h.where ? ` · ${h.where}` : ''}
                </span>
                <span className="result__title">
                  <Highlight text={h.title} terms={h.terms} />
                </span>
                {h.body && (
                  <span className="result__snip">
                    <Highlight text={snippet(h.body, h.terms)} terms={h.terms} />
                  </span>
                )}
              </span>
              {h.status && <StatusBadge status={h.status as Status} compact />}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
