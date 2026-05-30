import CrisisAlertIcon from '@mui/icons-material/CrisisAlert'
import HubIcon from '@mui/icons-material/Hub'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import { Box, CircularProgress, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { fetchOverview, type OverviewModules } from '../../api/dashboard'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

// Modules that expose a `total` we can surface as a live node count.
const MODULE_KEYS = [
  'personnel',
  'finance',
  'incidents',
  'assets',
  'gis',
  'operations',
  'documents',
] as const
type ModuleKey = (typeof MODULE_KEYS)[number]

// Geometry of the SVG canvas / hub-and-spoke layout.
const VIEW = 640
const CENTER = VIEW / 2
const RADIUS = 220
const NODE_R = 40

type NodeState = 'ok' | 'amber' | 'red'

interface TwinNode {
  key: ModuleKey
  label: string
  total: number
  state: NodeState
  x: number
  y: number
}

// Pull a per-module `total` where present. `finance` has no record count, so
// fall back to its contract count to keep the node meaningful.
function moduleTotal(modules: OverviewModules, key: ModuleKey): number | null {
  const mod = modules[key]
  if (!mod) return null
  if (key === 'finance') {
    const fin = modules.finance
    return fin ? fin.contracts : null
  }
  return 'total' in mod ? mod.total : null
}

const STATE_COLOR: Record<NodeState, string> = {
  ok: tokens.gold,
  amber: tokens.orange,
  red: tokens.red,
}

// Weighted penalty per alert severity for the operational-health gauge.
const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 18,
  high: 9,
  info: 2,
}

export function DigitalTwinPage() {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['twin-overview'],
    queryFn: fetchOverview,
  })

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }
  if (isError || !data) {
    return <Typography color="error">{t('common.loading', 'Loading…')}</Typography>
  }

  // Map alerts by module so each node can react to its own warnings.
  const alertByModule = new Map<string, NodeState>()
  for (const alert of data.alerts) {
    const next: NodeState = alert.severity === 'critical' ? 'red' : 'amber'
    const prev = alertByModule.get(alert.module)
    // 'red' dominates 'amber'.
    if (prev === 'red') continue
    alertByModule.set(alert.module, next)
  }

  const nodes: TwinNode[] = []
  const present = MODULE_KEYS.filter((k) => moduleTotal(data.modules, k) !== null)
  present.forEach((key, i) => {
    const total = moduleTotal(data.modules, key) ?? 0
    const angle = (i / present.length) * Math.PI * 2 - Math.PI / 2
    nodes.push({
      key,
      label: t(`nav.${key}`, key),
      total,
      state: alertByModule.get(key) ?? 'ok',
      x: CENTER + RADIUS * Math.cos(angle),
      y: CENTER + RADIUS * Math.sin(angle),
    })
  })

  // Operational health = 100 minus weighted alert penalty (clamped to 0..100).
  const penalty = data.alerts.reduce(
    (sum, a) => sum + (SEVERITY_WEIGHT[a.severity] ?? 0),
    0,
  )
  const health = Math.max(0, Math.min(100, 100 - penalty))
  const healthColor = health >= 80 ? tokens.green : health >= 50 ? tokens.orange : tokens.red

  const criticalCount = data.alerts.filter((a) => a.severity === 'critical').length
  const highCount = data.alerts.filter((a) => a.severity === 'high').length

  // Gauge ring geometry.
  const gaugeR = 52
  const gaugeC = 2 * Math.PI * gaugeR
  const gaugeOffset = gaugeC * (1 - health / 100)

  return (
    <Stack spacing={3}>
      <Typography variant="h5">{t('nav.twin', 'Digital Twin')}</Typography>

      <SectionCard
        title={t('twin.title', 'Operational digital twin')}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: healthColor }}>
            <HubIcon fontSize="small" />
            <Typography variant="subtitle2" sx={{ color: 'inherit' }}>
              {t('twin.health', 'Operational health')}: {health}%
            </Typography>
          </Box>
        }
      >
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            background: `radial-gradient(circle at 50% 45%, ${tokens.surface2}, ${tokens.bg})`,
            borderRadius: 2,
            border: `1px solid ${tokens.borderGold}`,
          }}
        >
          <Box
            component="svg"
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            role="img"
            aria-label={t('twin.diagramLabel', 'Institution hub-and-spoke diagram')}
            sx={{ width: '100%', height: 'auto', display: 'block' }}
          >
            <defs>
              <radialGradient id="twin-core" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={tokens.goldBright} />
                <stop offset="100%" stopColor={tokens.goldDim} />
              </radialGradient>
              <filter id="twin-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Connector spokes from the command core to each module node. */}
            {nodes.map((n) => (
              <line
                key={`spoke-${n.key}`}
                x1={CENTER}
                y1={CENTER}
                x2={n.x}
                y2={n.y}
                stroke={n.state === 'ok' ? tokens.borderGold : STATE_COLOR[n.state]}
                strokeWidth={n.state === 'ok' ? 1.5 : 2.5}
                strokeOpacity={0.7}
              />
            ))}

            {/* Central command node. */}
            <g filter="url(#twin-glow)">
              <circle cx={CENTER} cy={CENTER} r={NODE_R + 8} fill="url(#twin-core)" />
            </g>
            <circle
              cx={CENTER}
              cy={CENTER}
              r={NODE_R + 8}
              fill="none"
              stroke={tokens.goldBright}
              strokeWidth={1.5}
            />
            <text
              x={CENTER}
              y={CENTER - 2}
              textAnchor="middle"
              fontSize={13}
              fontWeight={700}
              fill={tokens.bg}
            >
              {t('twin.core', 'Command')}
            </text>
            <text
              x={CENTER}
              y={CENTER + 15}
              textAnchor="middle"
              fontSize={11}
              fill={tokens.bg}
            >
              {t('twin.coreSub', 'Core')}
            </text>

            {/* Module nodes — glowing, color-coded by alert state. */}
            {nodes.map((n) => {
              const color = STATE_COLOR[n.state]
              return (
                <g key={`node-${n.key}`} data-testid={`twin-node-${n.key}`}>
                  <g filter="url(#twin-glow)">
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={NODE_R}
                      fill={tokens.surface}
                      stroke={color}
                      strokeWidth={n.state === 'ok' ? 2 : 3}
                    />
                  </g>
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={NODE_R - 6}
                    fill="none"
                    stroke={color}
                    strokeOpacity={0.35}
                  />
                  <text
                    x={n.x}
                    y={n.y - 4}
                    textAnchor="middle"
                    fontSize={11}
                    fill={tokens.text}
                  >
                    {n.label}
                  </text>
                  <text
                    x={n.x}
                    y={n.y + 14}
                    textAnchor="middle"
                    fontSize={15}
                    fontWeight={700}
                    fill={color}
                  >
                    {n.total}
                  </text>
                </g>
              )
            })}
          </Box>

          {/* Health gauge overlay (bottom-end corner). */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 12,
              insetInlineEnd: 12,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Box component="svg" width={132} height={132} viewBox="0 0 132 132">
              <circle
                cx={66}
                cy={66}
                r={gaugeR}
                fill="none"
                stroke={tokens.border}
                strokeWidth={10}
              />
              <circle
                cx={66}
                cy={66}
                r={gaugeR}
                fill="none"
                stroke={healthColor}
                strokeWidth={10}
                strokeLinecap="round"
                strokeDasharray={gaugeC}
                strokeDashoffset={gaugeOffset}
                transform="rotate(-90 66 66)"
              />
              <text
                x={66}
                y={64}
                textAnchor="middle"
                fontSize={26}
                fontWeight={700}
                fill={tokens.text}
              >
                {health}
              </text>
              <text x={66} y={84} textAnchor="middle" fontSize={10} fill={tokens.muted}>
                {t('twin.healthShort', 'HEALTH')}
              </text>
            </Box>
          </Box>
        </Box>

        {/* Legend. */}
        <Stack direction="row" spacing={2.5} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
          {(
            [
              ['ok', t('twin.legendOk', 'Nominal')],
              ['amber', t('twin.legendAmber', 'Warning')],
              ['red', t('twin.legendRed', 'Critical')],
            ] as const
          ).map(([state, label]) => (
            <Box key={state} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: STATE_COLOR[state],
                  boxShadow: `0 0 8px ${STATE_COLOR[state]}`,
                }}
              />
              <Typography variant="caption" sx={{ color: tokens.muted }}>
                {label}
              </Typography>
            </Box>
          ))}
        </Stack>
      </SectionCard>

      {/* Critical / high alert summaries. */}
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <StatCard
          label={t('twin.criticalAlerts', 'Critical alerts')}
          value={criticalCount}
          accent={tokens.red}
          icon={<CrisisAlertIcon />}
        />
        <StatCard
          label={t('twin.highAlerts', 'High alerts')}
          value={highCount}
          accent={tokens.orange}
          icon={<ReportProblemIcon />}
        />
        <StatCard
          label={t('twin.activeNodes', 'Active nodes')}
          value={nodes.length}
          accent={tokens.gold}
          icon={<HubIcon />}
        />
      </Stack>
    </Stack>
  )
}
