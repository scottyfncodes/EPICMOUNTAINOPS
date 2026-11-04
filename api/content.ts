import { handler, listEntities, listImages, requireReader, send, keyMatches } from '../server/core.js'

export default handler({
  GET: async (req, res) => {
    requireReader(req)
    const [entities, images] = await Promise.all([listEntities(), listImages()])
    const key = req.headers['x-ops-key']
    send(res, 200, {
      entities,
      images,
      serverTime: new Date().toISOString(),
      editable: keyMatches(Array.isArray(key) ? key[0] : key),
    })
  },
})
