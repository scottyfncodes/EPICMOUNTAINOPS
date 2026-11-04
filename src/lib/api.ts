import type { ContentPayload, Entity, ImageMeta, VersionRecord } from '../../shared/types'

const KEY_STORAGE = 'ops.editKey'

export function getStoredKey(): string | null {
  try {
    return localStorage.getItem(KEY_STORAGE)
  } catch {
    return null
  }
}
export function storeKey(key: string | null) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key)
    else localStorage.removeItem(KEY_STORAGE)
  } catch {
    /* storage unavailable — key lives for this session only */
  }
}

let sessionKey: string | null = getStoredKey()
export const currentKey = () => sessionKey
export function setKey(key: string | null, remember = true) {
  sessionKey = key
  if (remember) storeKey(key)
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) }
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  if (sessionKey) headers['x-ops-key'] = sessionKey
  let res: Response
  try {
    res = await fetch(path, { ...init, headers })
  } catch {
    throw new ApiError(0, 'You appear to be offline. Changes were not saved.')
  }
  let data: any = null
  try {
    data = await res.json()
  } catch {
    /* non-JSON */
  }
  if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status})`)
  return data as T
}

export const api = {
  content: () => request<ContentPayload>('/api/content'),
  checkKey: (key: string) =>
    fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) }).then(async (r) => {
      await r.json().catch(() => null) // always drain the body so the connection is released
      if (r.status === 503) throw new ApiError(503, 'Editing is not configured on this server.')
      return r.ok
    }),
  save: (entity: Entity, opts: { baseUpdatedAt?: string; note?: string; action?: 'restore' } = {}) =>
    request<{ entity: Entity }>('/api/entities', { method: 'POST', body: JSON.stringify({ entity, ...opts }) }).then((r) => r.entity),
  remove: (id: string) => request<{ ok: true }>(`/api/entities?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  versions: (id: string) => request<{ versions: VersionRecord[] }>(`/api/versions?id=${encodeURIComponent(id)}`).then((r) => r.versions),
  uploadImage: (payload: { dataUrl: string; width: number; height: number; caption?: string }) =>
    request<{ image: ImageMeta }>('/api/images', { method: 'POST', body: JSON.stringify(payload) }).then((r) => r.image),
  lockSession: () => fetch('/api/auth', { method: 'DELETE' }).then((r) => r.json().catch(() => null)),
  session: () => fetch('/api/auth').then((r) => r.json() as Promise<{ private: boolean; session: boolean; editingConfigured: boolean }>),
  deleted: () => request<{ entities: (Entity & { deletedAt: string })[] }>('/api/entities?deleted=1').then((r) => r.entities),
  captionImage: (id: string, caption: string) => request('/api/images', { method: 'PATCH', body: JSON.stringify({ id, caption }) }),
}

export function imageUrl(id: string) {
  // Private mode is handled by an HttpOnly read-session cookie, so the key never appears in URLs.
  return `/api/images?id=${encodeURIComponent(id)}`
}
