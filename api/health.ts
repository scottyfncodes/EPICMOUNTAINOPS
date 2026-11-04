import { ensureReady, handler, send } from '../server/core.js'

export default handler({
  GET: async (_req, res) => {
    await ensureReady()
    send(res, 200, { ok: true, editingConfigured: Boolean(process.env.OPS_EDIT_KEY), private: process.env.OPS_PRIVATE === '1' })
  },
})
