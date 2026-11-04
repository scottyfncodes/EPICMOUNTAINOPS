import type { CSSProperties } from 'react'

/** A small, consistent line-icon set drawn on a 24px grid, 1.75 stroke. */
const PATHS: Record<string, string> = {
  home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5M10 20v-5.5h4V20',
  peaks: 'M2.5 19.5 9 8.5l3.5 6M8.5 19.5l7-11.5 6 11.5H2.5M13.6 11.6l1.9 1.4 1.6-1.3',
  flow: 'M6 3.5h4v4H6zM14 16.5h4v4h-4zM6 16.5h4v4H6zM8 7.5v9M8 12h8v4.5',
  system: 'M4 5.5h16v10H4zM9 19.5h6M12 15.5v4M7.5 9h4M7.5 12h6',
  book: 'M5 4.5h9.5a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17.5a3 3 0 0 1 3-3h9.5M9 8.5h5',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20.5 20.5',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  back: 'M15 5 8 12l7 7',
  close: 'M6 6l12 12M18 6 6 18',
  chevron: 'M9 5l7 7-7 7',
  down: 'M5 9l7 7 7-7',
  fit: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  zoomIn: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20.5 20.5M10.5 7.5v6M7.5 10.5h6',
  zoomOut: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20.5 20.5M7.5 10.5h6',
  target: 'M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  map: 'M3.5 6.5 9 4.5l6 2 5.5-2v13l-5.5 2-6-2-5.5 2zM9 4.5v13M15 6.5v13',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  warning: 'M12 4 2.8 19.5h18.4zM12 10v4.5M12 17v.01',
  image: 'M4 5h16v14H4zM4 15.5l4.5-4.5 4 4 2.5-2.5L20 17.5M15.5 9.5a1 1 0 1 0 0-.01',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  arrowRight: 'M4 12h15M13 6l6 6-6 6',
  history: 'M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 4v4.5H8M12 7.5V12l3 2',
  check: 'M4.5 12.5l5 5 10-11',
  trash: 'M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5M10 10.5v6M14 10.5v6',
  arrange: 'M4 4h6v5H4zM14 15h6v5h-6zM14 4h6v5h-6zM7 9v4.5h10V15',
  lock: 'M6 11h12v9.5H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  unlock: 'M6 11h12v9.5H6zM8.5 11V8a3.5 3.5 0 0 1 6.8-1.2',
  question: 'M9.2 9.2a3 3 0 1 1 4.3 2.7c-.9.5-1.5 1.2-1.5 2.1v.5M12 17.5v.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  camera: 'M4 8h3.5l1.5-2.5h6L16.5 8H20v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.01',
  minimap: 'M3.5 4.5h17v15h-17zM12.5 12.5h6v5h-6z',
  wrench: 'M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 0-2-2zM6 18l.01.01',
  layers: 'M12 3.5 21 8l-9 4.5L3 8zM3 12l9 4.5 9-4.5M3 16l9 4.5 9-4.5',
  split: 'M12 3v6M12 9 5 15v6M12 9l7 6v6',
  dot: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  inbox: 'M3.5 13.5 6 5h12l2.5 8.5V19h-17zM3.5 13.5h5l1 2.5h5l1-2.5h5',
  key: 'M14.5 13.5a5 5 0 1 0-4-4L3.5 16.5V20H7v-2h2v-2h2l1.5-1.5',
}

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 20, style, className }: { name: IconName | string; size?: number; style?: CSSProperties; className?: string }) {
  const d = PATHS[name] || PATHS.dot
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  )
}
