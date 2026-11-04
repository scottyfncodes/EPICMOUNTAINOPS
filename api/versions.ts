import { handler, HttpError, listVersions, query, requireReader, send } from '../server/core.js'

export default handler({
  GET: async (req, res) => {
    requireReader(req)
    const id = query(req, 'id')
    if (!id) throw new HttpError(400, 'Missing id')
    send(res, 200, { versions: await listVersions(id) })
  },
})
