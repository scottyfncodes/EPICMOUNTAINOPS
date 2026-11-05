import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CaptureProvider, useCapture } from '../lib/capture'
import { useStore } from '../lib/store'
import { CaptureSheet } from './Capture'
import { GlossaryPeekProvider } from './GlossaryPeek'
import { Icon, type IconName } from './Icon'
import { Sheet } from './Sheet'

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Command', icon: 'home', end: true },
  { to: '/departments', label: 'Departments', icon: 'peaks' },
  { to: '/workflows', label: 'Workflows', icon: 'flow' },
  { to: '/systems', label: 'Systems', icon: 'system' },
  { to: '/glossary', label: 'Glossary', icon: 'book' },
]

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="wordmark" aria-label="Epic Mountain Ops — Command Center">
      <svg className="wordmark__mark" viewBox="0 0 512 512" aria-hidden="true">
        <rect width="512" height="512" rx="56" fill="var(--ink-2)" />
        <path d="M72 380 206 158 282 280 322 218 440 380Z" fill="#53656f" />
        <path d="M206 158 282 280 322 218 440 380H330Z" fill="#2a363c" opacity=".7" />
        <path d="M206 158 242 216 224 230 208 214 190 232 176 208ZM322 218 348 254 334 263 322 251 308 264 297 256Z" fill="var(--paper)" />
        <rect x="72" y="414" width="368" height="18" fill="var(--signal)" />
      </svg>
      {!compact && (
        <span className="wordmark__text">
          <b>Epic Mountain</b>
          <span>Ops</span>
        </span>
      )}
    </Link>
  )
}

export function AppShell() {
  return (
    <CaptureProvider>
      <GlossaryPeekProvider>
        <Shell />
      </GlossaryPeekProvider>
    </CaptureProvider>
  )
}

function AddButton() {
  const { open } = useCapture()
  const { canEdit, requestEdit } = useStore()
  return (
    <button className="btn btn--primary btn--add" onClick={() => (canEdit ? open('menu') : requestEdit())} aria-label="Capture information">
      <Icon name="plus" size={18} />
      <span>Add</span>
    </button>
  )
}

function Shell() {
  const { state, atlas, canEdit, lock, requestEdit, offline } = useStore()
  const location = useLocation()
  const navigate = useNavigate()
  const immersive = /^\/workflows\/[^/]+/.test(location.pathname)
  const reviewCount = atlas.all.filter((e) => (e.type === 'note' && e.kind === 'question' && !e.resolved) || e.status === 'outdated').length

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        navigate('/search')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  // Scroll to top on page change (not on hash/search changes).
  useEffect(() => {
    if (!location.hash) window.scrollTo(0, 0)
  }, [location.pathname, location.hash])

  return (
    <div className={`shell ${immersive ? 'shell--immersive' : ''}`}>
      {!immersive && (
        <>
          <header className="topbar">
            <Wordmark />
            <div className="topbar__actions">
              <Link to="/search" className="iconbtn iconbtn--lg" aria-label="Search everything">
                <Icon name="search" />
              </Link>
              <Link to="/review" className="iconbtn iconbtn--lg badge-host" aria-label={`Review queue, ${reviewCount} open`}>
                <Icon name="inbox" />
                {reviewCount > 0 && <span className="badge">{reviewCount}</span>}
              </Link>
              <button
                className={`iconbtn iconbtn--lg ${canEdit ? 'is-active' : ''}`}
                onClick={() => (canEdit ? (confirm('Lock editing on this device?') ? lock() : null) : requestEdit())}
                aria-label={canEdit ? 'Editing unlocked — tap to lock' : 'Unlock editing'}
                title={canEdit ? 'Editing unlocked' : 'Unlock editing'}
              >
                <Icon name={canEdit ? 'unlock' : 'lock'} />
              </button>
              <AddButton />
            </div>
          </header>
          <nav className="rail" aria-label="Primary">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className="rail__item" viewTransition>
                <Icon name={n.icon} size={22} />
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>
        </>
      )}
      {offline && !immersive && (
        <div className="offline-bar" role="status">
          Offline — showing your last synced copy. Editing is paused.
        </div>
      )}
      <main className="main" id="main">
        {state === 'loading' ? <LoadingScreen /> : state === 'error' ? <ErrorScreen /> : state === 'locked' ? <LockedScreen /> : <Outlet />}
      </main>
      <Toasts />
      <KeyDialog />
      <CaptureSheet />
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="loading" aria-busy="true" aria-live="polite">
      <div className="loading__ridge" />
      <p>Loading the atlas…</p>
    </div>
  )
}

function ErrorScreen() {
  const { error, refresh } = useStore()
  return (
    <div className="fullstate">
      <Icon name="warning" size={28} />
      <h1>Couldn’t load the atlas</h1>
      <p>{error}</p>
      <button className="btn btn--primary" onClick={refresh}>
        Try again
      </button>
    </div>
  )
}

function LockedScreen() {
  const { requestEdit } = useStore()
  return (
    <div className="fullstate">
      <Icon name="lock" size={28} />
      <h1>This atlas is private</h1>
      <p>Enter your key to open it on this device.</p>
      <button className="btn btn--primary" onClick={requestEdit}>
        Enter key
      </button>
    </div>
  )
}

function Toasts() {
  const { toasts, dismissToast } = useStore()
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className={`toast toast--${t.kind}`} onClick={() => dismissToast(t.id)}>
          <Icon name={t.kind === 'error' ? 'warning' : t.kind === 'info' ? 'info' : 'check'} size={16} />
          {t.text}
        </button>
      ))}
    </div>
  )
}

function KeyDialog() {
  const { keyPrompt, closeKeyPrompt, unlock, isPrivate } = useStore()
  const [key, setKey] = useState('')
  const [remember, setRemember] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (keyPrompt) {
      setKey('')
      setErr(null)
    }
  }, [keyPrompt])
  return (
    <Sheet open={keyPrompt} onClose={closeKeyPrompt} modal title={isPrivate ? 'Unlock the atlas' : 'Unlock editing'} kicker="Owner access" className="sheet--compact" labelledBy="key-title">
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setErr(null)
          try {
            const ok = await unlock(key.trim(), remember)
            if (!ok) setErr('That key didn’t match.')
          } catch (er) {
            setErr((er as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        <p className="muted">
          {isPrivate
            ? 'This atlas is private. Your key opens it on this device and allows editing.'
            : 'Reading is open. Changing content needs your edit key — it’s set as OPS_EDIT_KEY in the hosting settings.'}
        </p>
        <div className="fi">
          <label className="fi__label" htmlFor="edit-key">
            Edit key
          </label>
          <input id="edit-key" className="input" type="password" autoComplete="current-password" value={key} onChange={(e) => setKey(e.target.value)} autoFocus />
        </div>
        <label className="check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>Remember on this device</span>
        </label>
        {err && (
          <p className="error-text" role="alert">
            {err}
          </p>
        )}
        <button className="btn btn--primary btn--block" disabled={busy || !key.trim()}>
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </Sheet>
  )
}
