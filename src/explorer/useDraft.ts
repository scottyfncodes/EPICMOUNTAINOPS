import { useCallback, useEffect, useRef, useState } from 'react'
import type { Workflow } from '../../shared/types'

const MAX_HISTORY = 60
const KEY = (id: string) => `ops.draft.${id}`

interface Stored {
  baseUpdatedAt: string
  draft: Workflow
  savedAt: string
}

/** Read a locally autosaved draft, only if it was made against the current server version. */
export function readStoredDraft(wf: Workflow): Stored | null {
  try {
    const raw = localStorage.getItem(KEY(wf.id))
    if (!raw) return null
    const s = JSON.parse(raw) as Stored
    return s.baseUpdatedAt === wf.updatedAt ? s : null
  } catch {
    return null
  }
}

export function clearStoredDraft(id: string) {
  try {
    localStorage.removeItem(KEY(id))
  } catch {
    /* ignore */
  }
}

/**
 * Editable copy of a workflow with undo/redo. Consecutive changes with the same
 * `group` key (e.g. typing in one field, dragging one node) merge into a single
 * undo step so undo feels natural.
 */
export function useDraft(initial: Workflow | null) {
  const [draft, setDraftState] = useState<Workflow | null>(initial)
  const [dirty, setDirty] = useState(false)
  const current = useRef<Workflow | null>(initial)
  const dirtyRef = useRef(false)
  const past = useRef<Workflow[]>([])
  const future = useRef<Workflow[]>([])
  const lastGroup = useRef<string | null>(null)

  const commit = (w: Workflow | null, isDirty: boolean) => {
    current.current = w
    dirtyRef.current = isDirty
    setDraftState(w)
    setDirty(isDirty)
  }

  const update = useCallback((fn: (w: Workflow) => Workflow, group?: string) => {
    const d = current.current
    if (!d) return
    const next = fn(d)
    if (next === d) return
    if (!group || group !== lastGroup.current) {
      past.current.push(d)
      if (past.current.length > MAX_HISTORY) past.current.shift()
    }
    lastGroup.current = group ?? null
    future.current = []
    commit(next, true)
  }, [])

  const undo = useCallback(() => {
    const d = current.current
    const prev = past.current.pop()
    if (!prev || !d) return
    future.current.push(d)
    lastGroup.current = null
    commit(prev, true)
  }, [])

  const redo = useCallback(() => {
    const d = current.current
    const next = future.current.pop()
    if (!next || !d) return
    past.current.push(d)
    lastGroup.current = null
    commit(next, true)
  }, [])

  /** Replace the draft without recording history (load / save / discard). */
  const reset = useCallback((w: Workflow | null, isDirty = false) => {
    past.current = []
    future.current = []
    lastGroup.current = null
    commit(w, isDirty)
  }, [])

  // Autosave the working copy on this device while there are unsaved changes.
  useEffect(() => {
    if (!draft || !dirty) return
    const t = setTimeout(() => {
      try {
        const stored: Stored = { baseUpdatedAt: draft.updatedAt, draft, savedAt: new Date().toISOString() }
        localStorage.setItem(KEY(draft.id), JSON.stringify(stored))
      } catch {
        /* storage full or unavailable — the in-memory draft still exists */
      }
    }, 400)
    return () => clearTimeout(t)
  }, [draft, dirty])

  return {
    draft,
    dirty,
    update,
    undo,
    redo,
    reset,
    /** Synchronous reads for effects that must not use stale closures. */
    getCurrent: () => current.current,
    isDirty: () => dirtyRef.current,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  }
}
