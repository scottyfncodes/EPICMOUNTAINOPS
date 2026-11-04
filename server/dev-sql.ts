/**
 * DEV ONLY — an in-process Postgres (PGlite) that mimics the subset of the
 * Neon serverless driver used by server/core.ts. Injected by vite.config.ts
 * when OPS_DEV_DB=pglite, so local development and automated tests can run
 * without network access to Neon. Never imported by production code.
 */
import { PGlite } from '@electric-sql/pglite'

type Lazy = { text: string; params: unknown[]; then: Promise<unknown[]>['then'] }

export async function createDevSql(dataDir: string) {
  const pg = new PGlite(dataDir)
  await pg.waitReady
  const run = async (text: string, params: unknown[] = []) => (await pg.query(text, params as any[])).rows
  const query = (text: string, params: unknown[] = []): Lazy => {
    let p: Promise<unknown[]> | null = null
    return {
      text,
      params,
      then(onF, onR) {
        p ??= run(text, params)
        return p.then(onF, onR)
      },
    } as Lazy
  }
  return {
    query,
    transaction: async (qs: Lazy[]) =>
      pg.transaction(async (tx) => {
        const out = []
        for (const q of qs) out.push((await tx.query(q.text, q.params as any[])).rows)
        return out
      }),
  }
}
