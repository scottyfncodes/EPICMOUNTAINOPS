import { useMemo } from 'react'

/** Deterministic pseudo-random generator so art is stable between renders. */
function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 10000) / 10000
  }
}
function hashString(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Topographic contour lines — used as quiet texture on department cards. */
export function Topo({ seed, className = '', lines = 9 }: { seed: string; className?: string; lines?: number }) {
  const paths = useMemo(() => {
    const r = rng(hashString(seed))
    const cx = 220 + r() * 160
    const cy = 60 + r() * 80
    const out: string[] = []
    for (let k = 0; k < lines; k++) {
      const rad = 22 + k * 26
      const pts: [number, number][] = []
      const wob = [r() * 0.22, r() * 0.18, r() * 0.14]
      const ph = [r() * 6.28, r() * 6.28, r() * 6.28]
      const N = 48
      for (let i = 0; i < N; i++) {
        const t = (i / N) * Math.PI * 2
        const m = 1 + wob[0] * Math.sin(2 * t + ph[0]) + wob[1] * Math.sin(3 * t + ph[1]) + wob[2] * Math.sin(5 * t + ph[2] + k * 0.3)
        pts.push([cx + Math.cos(t) * rad * m * 1.35, cy + Math.sin(t) * rad * m * 0.8])
      }
      let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
      for (let i = 0; i < N; i++) {
        const p0 = pts[(i - 1 + N) % N]
        const p1 = pts[i]
        const p2 = pts[(i + 1) % N]
        const p3 = pts[(i + 2) % N]
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
        d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
      }
      out.push(d)
    }
    return out
  }, [seed, lines])
  return (
    <svg className={`topo ${className}`} viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={i % 4 === 0 ? 1.1 : 0.6} opacity={i % 4 === 0 ? 0.9 : 0.55} />
      ))}
    </svg>
  )
}

/** Layered ridgeline for the Command Center masthead. */
export function Ridgeline({ className = '' }: { className?: string }) {
  const layers = useMemo(() => {
    const r = rng(7331)
    const make = (base: number, amp: number, n: number) => {
      const pts: [number, number][] = [[0, base]]
      for (let i = 1; i < n; i++) {
        const x = (i / n) * 1200
        const y = base - amp * (0.35 + r() * 0.65) * (i % 2 ? 1 : 0.45)
        pts.push([x, y])
      }
      pts.push([1200, base - amp * 0.3])
      return `M0 400 L${pts.map(([x, y]) => `${x.toFixed(0)} ${y.toFixed(0)}`).join(' L')} L1200 400 Z`
    }
    return [make(250, 150, 15), make(300, 120, 19), make(345, 80, 25)]
  }, [])
  return (
    <svg className={`ridge ${className}`} viewBox="0 0 1200 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="ridge-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--ink)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--ink)" stopOpacity="1" />
        </linearGradient>
      </defs>
      <path d={layers[0]} fill="var(--ridge-1)" />
      <path d={layers[1]} fill="var(--ridge-2)" />
      <path d={layers[2]} fill="var(--ridge-3)" />
      <rect x="0" y="200" width="1200" height="200" fill="url(#ridge-fade)" />
    </svg>
  )
}
