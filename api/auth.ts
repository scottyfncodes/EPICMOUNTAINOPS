import { handler, hasReadSession, isPrivate, keyMatches, readCookieHeader, readJson, send } from '../server/core.js'

export default handler({
  /** Session state, so a private atlas can show its lock screen without leaking content. */
  GET: async (req, res) => {
    send(res, 200, { private: isPrivate(), session: hasReadSession(req), editingConfigured: Boolean(process.env.OPS_EDIT_KEY) })
  },
  POST: async (req, res) => {
    const body = await readJson<{ key?: string }>(req)
    // Small fixed delay blunts rapid guessing.
    await new Promise((r) => setTimeout(r, 400))
    if (!process.env.OPS_EDIT_KEY) return send(res, 503, { ok: false, error: 'Editing is not configured on this server.' })
    const ok = keyMatches(body.key)
    // A successful unlock also opens a read session (HttpOnly cookie) so images load in private mode.
    send(res, ok ? 200 : 401, { ok }, ok ? { 'Set-Cookie': readCookieHeader() } : {})
  },
  /** Lock this device: clears the read session. */
  DELETE: async (_req, res) => {
    send(res, 200, { ok: true }, { 'Set-Cookie': readCookieHeader(true) })
  },
})
