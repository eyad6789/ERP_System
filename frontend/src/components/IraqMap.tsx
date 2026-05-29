import { useMemo } from 'react'

import { classification as CLASS } from '../theme/tokens'

// Simplified Iraq national boundary (lng, lat), clockwise. Coarse but accurate
// enough to read as Iraq; fully offline (no tiles). MapLibre + self-hostable
// vector tiles is the production path.
const IRAQ: [number, number][] = [
  [42.35, 37.11], [43.1, 37.37], [44.0, 37.2], [44.79, 37.16], [45.3, 36.62],
  [45.45, 35.83], [46.18, 35.19], [45.7, 34.55], [46.1, 33.9], [47.13, 33.69],
  [47.37, 33.06], [47.68, 32.49], [47.85, 31.79], [47.67, 31.0], [48.01, 30.99],
  [48.57, 30.45], [48.4, 29.96], [47.69, 30.1], [47.45, 30.0], [46.55, 29.06],
  [44.72, 29.2], [43.1, 30.55], [42.08, 31.1], [40.42, 31.95], [38.79, 33.38],
  [40.69, 34.43], [41.22, 34.77], [41.4, 35.62], [42.35, 37.11],
]

const W = 1000
const H = 760
const PAD = 60

export interface MapSite {
  id: number
  name_ar: string
  name_en: string
  site_type: string
  lat: number
  lng: number
  classification: number
}

function useProjection() {
  return useMemo(() => {
    const lngs = IRAQ.map((p) => p[0])
    const lats = IRAQ.map((p) => p[1])
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const sx = (W - PAD * 2) / (maxLng - minLng)
    const sy = (H - PAD * 2) / (maxLat - minLat)
    const s = Math.min(sx, sy)
    const offX = (W - (maxLng - minLng) * s) / 2
    const offY = (H - (maxLat - minLat) * s) / 2
    const project = (lng: number, lat: number): [number, number] => [
      offX + (lng - minLng) * s,
      offY + (maxLat - lat) * s, // flip Y (north up)
    ]
    return { project }
  }, [])
}

export function IraqMap({
  sites,
  ar,
  onSelect,
}: {
  sites: MapSite[]
  ar: boolean
  onSelect?: (id: number) => void
}) {
  const { project } = useProjection()
  const path = useMemo(
    () => IRAQ.map(([lng, lat], i) => `${i ? 'L' : 'M'}${project(lng, lat).join(',')}`).join(' ') + 'Z',
    [project],
  )

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="iraqFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2620" />
          <stop offset="100%" stopColor="#1b1916" />
        </linearGradient>
        <filter id="goldGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="vignette" cx="50%" cy="42%" r="70%">
          <stop offset="60%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
        </radialGradient>
      </defs>

      {/* graticule */}
      <g stroke="rgba(201,162,39,0.07)" strokeWidth="1">
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`v${i}`} x1={(W / 9) * (i + 1)} y1="0" x2={(W / 9) * (i + 1)} y2={H} />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={(H / 7) * (i + 1)} x2={W} y2={(H / 7) * (i + 1)} />
        ))}
      </g>

      {/* country body */}
      <path d={path} fill="url(#iraqFill)" stroke="#c9a227" strokeWidth="2.5" strokeLinejoin="round" filter="url(#goldGlow)" />
      <path d={path} fill="none" stroke="rgba(230,199,87,0.5)" strokeWidth="1" strokeLinejoin="round" />

      {/* sites */}
      {sites.map((s) => {
        const [x, y] = project(s.lng, s.lat)
        const color = CLASS[s.classification as 1 | 2 | 3 | 4]?.color ?? '#c9a227'
        return (
          <g
            key={s.id}
            transform={`translate(${x},${y})`}
            style={{ cursor: onSelect ? 'pointer' : 'default' }}
            onClick={() => onSelect?.(s.id)}
            data-testid="iraq-marker"
          >
            <circle r="16" fill={color} opacity="0.16">
              <animate attributeName="r" values="10;20;10" dur="3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.28;0;0.28" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle r="6" fill={color} stroke="#16140d" strokeWidth="1.5" />
            <text
              x="0"
              y="-14"
              textAnchor="middle"
              fontSize="15"
              fontFamily='"El Messiri", serif'
              fill="#f1ece1"
              style={{ pointerEvents: 'none' }}
            >
              {ar ? s.name_ar : s.name_en}
            </text>
          </g>
        )
      })}

      <rect x="0" y="0" width={W} height={H} fill="url(#vignette)" pointerEvents="none" />
    </svg>
  )
}
