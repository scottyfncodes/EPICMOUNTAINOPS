import { handler, keyMatches, readJson, send } from '../server/core.js'

export default handler({
  POST: async (req, res) => {
    const body = await readJson<{ key?: string }>(req)
    // Small fixed delay blunts rapid guessing.
    await new Promise((r) => setTimeout(r, 400))
    if (!process.env.OPS_EDIT_KEY) return send(res, 503, { ok: false, error: 'Editing is not configured on this server.' })
    send(res, keyMatches(body.key) ? 200 : 401, { ok: keyMatches(body.key) })
  },
})
