import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import CloseIcon from '@mui/icons-material/Close'
import GavelIcon from '@mui/icons-material/Gavel'
import GroupIcon from '@mui/icons-material/Group'
import PaymentsIcon from '@mui/icons-material/Payments'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { fetchOverview, type Overview } from '../../api/dashboard'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { classification, tokens } from '../../theme/tokens'

const STORAGE_KEY = 'erp.dashboard.layout'

const tooltipStyle = {
  background: tokens.surface2,
  border: `1px solid ${tokens.border}`,
  borderRadius: 8,
  color: tokens.text,
} as const

// The fixed catalogue of widget kinds the user can drop onto the canvas.
const WIDGET_TYPES = [
  'kpi-users',
  'kpi-incidents',
  'kpi-budget',
  'clearance-pie',
  'activity-bar',
  'alerts-list',
  'recent-audit',
] as const
type WidgetType = (typeof WIDGET_TYPES)[number]

function isWidgetType(value: unknown): value is WidgetType {
  return typeof value === 'string' && (WIDGET_TYPES as readonly string[]).includes(value)
}

function widgetLabel(type: WidgetType, t: TFunction): string {
  switch (type) {
    case 'kpi-users':
      return t('builder.kpiUsers', 'Total users')
    case 'kpi-incidents':
      return t('builder.kpiIncidents', 'Open incidents')
    case 'kpi-budget':
      return t('builder.kpiBudget', 'Budget remaining')
    case 'clearance-pie':
      return t('builder.clearancePie', 'Clearance mix')
    case 'activity-bar':
      return t('builder.activityBar', 'Audit activity')
    case 'alerts-list':
      return t('builder.alertsList', 'System alerts')
    case 'recent-audit':
      return t('builder.recentAudit', 'Recent audit')
  }
}

// Each placed widget gets a stable instance id so duplicates can coexist.
interface PlacedWidget {
  id: string
  type: WidgetType
}

function newId(): string {
  const buf = new Uint32Array(2)
  crypto.getRandomValues(buf)
  return `${buf[0]!.toString(16)}${buf[1]!.toString(16)}`
}

// Parse a previously-persisted layout, tolerating malformed JSON / shapes.
function loadLayout(): PlacedWidget[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const result: PlacedWidget[] = []
    for (const item of parsed) {
      if (
        item &&
        typeof item === 'object' &&
        'id' in item &&
        'type' in item &&
        typeof (item as { id: unknown }).id === 'string' &&
        isWidgetType((item as { type: unknown }).type)
      ) {
        result.push({ id: (item as { id: string }).id, type: (item as { type: WidgetType }).type })
      }
    }
    return result
  } catch {
    return []
  }
}

const alertColor: Record<Overview['alerts'][number]['severity'], string> = {
  critical: tokens.red,
  high: tokens.orange,
  info: tokens.cyan,
}

function parseMoney(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

// Render a single placed widget against the live overview payload.
function WidgetView({
  type,
  data,
  t,
  lang,
}: {
  type: WidgetType
  data: Overview
  t: TFunction
  lang: string
}) {
  switch (type) {
    case 'kpi-users':
      return (
        <StatCard
          label={t('builder.kpiUsers', 'Total users')}
          value={data.kpis.total_users}
          accent={tokens.gold}
          icon={<GroupIcon />}
        />
      )
    case 'kpi-incidents':
      return (
        <StatCard
          label={t('builder.kpiIncidents', 'Open incidents')}
          value={data.modules.incidents?.open ?? 0}
          accent={tokens.red}
          icon={<WarningAmberIcon />}
        />
      )
    case 'kpi-budget':
      return (
        <StatCard
          label={t('builder.kpiBudget', 'Budget remaining')}
          value={parseMoney(data.modules.finance?.remaining ?? '0').toLocaleString()}
          accent={tokens.green}
          icon={<PaymentsIcon />}
        />
      )
    case 'clearance-pie': {
      const pieData = data.clearance_distribution
        .filter((d) => d.count > 0)
        .map((d) => ({
          name: t(`clearance.${d.level}`),
          value: d.count,
          color: classification[d.level as 1 | 2 | 3 | 4]?.color ?? tokens.cyan,
        }))
      return (
        <SectionCard title={t('builder.clearancePie', 'Clearance mix')}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={44}
                outerRadius={82}
                paddingAngle={2}
                label={(e: { value: number }) => `${e.value}`}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke={tokens.surface} strokeWidth={2} />
                ))}
              </Pie>
              <Legend />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(201,162,39,0.06)' }} />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>
      )
    }
    case 'activity-bar': {
      const barData = data.audit_activity.map((p) => ({
        date: p.date,
        granted: p.granted,
        denied: p.denied,
      }))
      return (
        <SectionCard title={t('builder.activityBar', 'Audit activity')}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ left: 4, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.border} vertical={false} />
              <XAxis dataKey="date" stroke={tokens.muted} fontSize={11} tickLine={false} />
              <YAxis stroke={tokens.muted} fontSize={11} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(201,162,39,0.06)' }} />
              <Legend />
              <Bar
                dataKey="granted"
                name={t('builder.granted', 'Granted')}
                fill={tokens.gold}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="denied"
                name={t('builder.denied', 'Denied')}
                fill={tokens.red}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      )
    }
    case 'alerts-list':
      return (
        <SectionCard title={t('builder.alertsList', 'System alerts')}>
          {data.alerts.length === 0 ? (
            <Typography sx={{ color: tokens.muted }}>
              {t('builder.noAlerts', 'No active alerts')}
            </Typography>
          ) : (
            <Stack spacing={1}>
              {data.alerts.map((a, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.25,
                    borderRadius: 1,
                    border: `1px solid ${tokens.border}`,
                    borderInlineStart: `3px solid ${alertColor[a.severity]}`,
                  }}
                >
                  <Chip
                    label={t(`builder.severity.${a.severity}`, a.severity)}
                    size="small"
                    sx={{ color: alertColor[a.severity], borderColor: alertColor[a.severity] }}
                    variant="outlined"
                  />
                  <Typography sx={{ color: tokens.text, flex: 1 }}>
                    {lang === 'ar' ? a.message_ar : a.message_en}
                  </Typography>
                  <Typography sx={{ color: tokens.muted, fontWeight: 700 }}>{a.count}</Typography>
                </Box>
              ))}
            </Stack>
          )}
        </SectionCard>
      )
    case 'recent-audit': {
      const rows = data.recent_audit ?? []
      return (
        <SectionCard title={t('builder.recentAudit', 'Recent audit')}>
          {rows.length === 0 ? (
            <Typography sx={{ color: tokens.muted }}>
              {t('builder.noAudit', 'No recent activity')}
            </Typography>
          ) : (
            <Stack spacing={1}>
              {rows.slice(0, 6).map((r, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    pb: 0.75,
                    borderBottom: `1px solid ${tokens.border}`,
                  }}
                >
                  <Typography sx={{ color: tokens.text, flex: 1 }}>
                    {r.actor_label} · {r.action}
                  </Typography>
                  <Chip
                    label={t(`builder.result.${r.result}`, r.result)}
                    size="small"
                    variant="outlined"
                    sx={{
                      color: r.result === 'GRANTED' ? tokens.green : tokens.red,
                      borderColor: r.result === 'GRANTED' ? tokens.green : tokens.red,
                    }}
                  />
                </Box>
              ))}
            </Stack>
          )}
        </SectionCard>
      )
    }
  }
}

export function DashboardBuilderPage() {
  const { t, i18n } = useTranslation()
  const [layout, setLayout] = useState<PlacedWidget[]>(() => loadLayout())

  const { data, isLoading, isError } = useQuery({
    queryKey: ['builder-overview'],
    queryFn: fetchOverview,
  })

  // Persist the layout (ids + types) whenever it changes.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  }, [layout])

  const addWidget = useCallback((type: WidgetType) => {
    setLayout((prev) => [...prev, { id: newId(), type }])
  }, [])

  const removeWidget = useCallback((id: string) => {
    setLayout((prev) => prev.filter((w) => w.id !== id))
  }, [])

  const move = useCallback((id: string, delta: -1 | 1) => {
    setLayout((prev) => {
      const idx = prev.findIndex((w) => w.id === id)
      const target = idx + delta
      if (idx < 0 || target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const a = next[idx]!
      const b = next[target]!
      next[idx] = b
      next[target] = a
      return next
    })
  }, [])

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }
  if (isError || !data) {
    return <Typography color="error">{t('common.loading')}</Typography>
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h5">{t('nav.builder', 'Dashboard Builder')}</Typography>

      {/* Palette of available widget types */}
      <SectionCard title={t('builder.palette', 'Widget palette')}>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          {WIDGET_TYPES.map((type) => (
            <Button
              key={type}
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => addWidget(type)}
              data-testid={`add-${type}`}
              sx={{ color: tokens.text, borderColor: tokens.border }}
            >
              {widgetLabel(type, t)}
            </Button>
          ))}
        </Stack>
      </SectionCard>

      {/* The composed canvas */}
      {layout.length === 0 ? (
        <Box
          sx={{
            display: 'grid',
            placeItems: 'center',
            minHeight: 200,
            border: `1px dashed ${tokens.border}`,
            borderRadius: 2,
            color: tokens.muted,
          }}
          data-testid="builder-empty"
        >
          <GavelIcon sx={{ fontSize: 28, mb: 1 }} />
          <Typography>{t('builder.emptyCanvas', 'Add widgets to build your dashboard')}</Typography>
        </Box>
      ) : (
        <Stack spacing={2} data-testid="builder-canvas">
          {layout.map((w, i) => (
            <Box key={w.id} sx={{ position: 'relative' }} data-testid={`widget-${w.type}`}>
              <Stack
                direction="row"
                spacing={0.5}
                sx={{ position: 'absolute', insetInlineEnd: 8, top: 8, zIndex: 2 }}
              >
                <IconButton
                  size="small"
                  aria-label={t('builder.moveUp', 'Move up')}
                  disabled={i === 0}
                  onClick={() => move(w.id, -1)}
                  sx={{ color: tokens.muted }}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={t('builder.moveDown', 'Move down')}
                  disabled={i === layout.length - 1}
                  onClick={() => move(w.id, 1)}
                  sx={{ color: tokens.muted }}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={t('builder.remove', 'Remove')}
                  onClick={() => removeWidget(w.id)}
                  sx={{ color: tokens.red }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
              <WidgetView type={w.type} data={data} t={t} lang={i18n.language} />
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
