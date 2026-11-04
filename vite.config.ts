import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Serves /api/* from the same handler files Vercel deploys, so local
 * development exercises the real API against the real database.
 */
function devApi(): Plugin {
  return {
    name: 'ops-dev-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      let devDb: Promise<unknown> | null = null
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        if (process.env.OPS_DEV_DB === 'pglite' && !devDb) {
          devDb = server.ssrLoadModule('/server/dev-sql.ts').then(async (m) => {
            ;(globalThis as any).__opsDevSql = await m.createDevSql(process.env.OPS_DEV_DB_DIR || './.devdb')
          })
        }
        if (devDb) await devDb
        const name = req.url.slice(5).split(/[?/]/)[0]
        if (!/^[a-z-]+$/.test(name)) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`)
          await mod.default(req, res)
        } catch (err) {
          console.error(err)
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(err) }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
    plugins: [react(), devApi()],
    build: {
      target: 'es2020',
      chunkSizeWarningLimit: 700,
    },
  }
})
