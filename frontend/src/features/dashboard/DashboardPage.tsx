import ArticleIcon from '@mui/icons-material/Article'
import AssignmentIcon from '@mui/icons-material/Assignment'
import InventoryIcon from '@mui/icons-material/Inventory2'
import PlaceIcon from '@mui/icons-material/Place'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import SavingsIcon from '@mui/icons-material/Savings'
import SecurityIcon from '@mui/icons-material/Security'
import GroupIcon from '@mui/icons-material/Group'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { Box, Chip, CircularProgress, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
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

import { fetchOverview, type OverviewAlert } from '../../api/dashboard'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { classification, tokens } from '../../theme/tokens'

const tooltipStyle = {
  background: tokens.surface2,
  border: `1px solid ${tokens.border}`,
  borderRadius: 8,
  color: tokens.text,
} as const

// Alert severity -> MUI chip color + accent token.
const ALERT_COLOR: Record<OverviewAlert['severity'], 'error' | 'warning' | 'info'> = {
  critical: 'error',
  high: 'warning',
  info: 'info',
}
const ALERT_ACCENT: Record<OverviewAlert['severity'], string> = {
  critical: tokens.red,
  high: tokens.orange,
  info: tokens.cyan,
}

function pct(spent: string, total: string): string {
  const s = Number(spent)
  const t = Number(total)
  if (!Number.isFinite(s) || !Number.isFinite(t) || t <= 0) return '0%'
  return `${Math.round((s / t) * 100)}%`
}

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-overview'],
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
    return <Typography color="error">{t('common.loading')}</Typography>
  }

  const m = data.modules
  const assetsOperational = m.assets
    ? m.assets.by_condition.find((c) => c.condition === 'operational')?.count ?? 0
    : 0

  const pieData = data.clearance_distribution.map((d) => ({
    name: t(`clearance.${d.level}`),
    value: d.count,
    color: classification[d.level as 1 | 2 | 3 | 4]?.color ?? tokens.cyan,
  }))
  const activityData = data.audit_activity.map((a) => ({
    day: a.date.slice(5), // MM-DD
    granted: a.granted,
    denied: a.denied,
  }))

  return (
    <Stack spacing={3}>
      <Typography variant="h5">{t('dashboard.commandCenter')}</Typography>

      {/* ALERTS strip */}
      {data.alerts.length > 0 && (
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          {data.alerts.map((alert, i) => (
            <Box
              key={i}
              sx={{
                flex: '1 1 280px',
                minWidth: 260,
                p: 1.5,
                borderRadius: 2,
                bgcolor: tokens.surface,
                borderInlineStart: `3px solid ${ALERT_ACCENT[alert.severity]}`,
                border: `1px solid ${tokens.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
              }}
            >
              <WarningAmberIcon sx={{ color: ALERT_ACCENT[alert.severity], fontSize: 22 }} />
              <Typography variant="body2" sx={{ color: tokens.text, flex: 1 }}>
                {ar ? alert.message_ar : alert.message_en}
              </Typography>
              <Chip
                label={alert.count}
                size="small"
                color={ALERT_COLOR[alert.severity]}
                variant="outlined"
              />
            </Box>
          ))}
        </Stack>
      )}

      {/* Cross-module KPI grid */}
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        {m.personnel && (
          <StatCard
            label={t('dashboard.headcount')}
            value={m.personnel.total}
            accent={tokens.cyan}
            icon={<GroupIcon />}
          />
        )}
        {m.documents && (
          <StatCard
            label={t('dashboard.classified')}
            value={m.documents.total}
            accent={tokens.gold}
            icon={<ArticleIcon />}
          />
        )}
        {m.finance && (
          <StatCard
            label={t('dashboard.budget')}
            value={pct(m.finance.spent, m.finance.budget_total)}
            accent={tokens.orange}
            icon={<SavingsIcon />}
          />
        )}
        {m.operations && (
          <StatCard
            label={t('dashboard.openTasks')}
            value={m.operations.total}
            accent={tokens.green}
            icon={<AssignmentIcon />}
          />
        )}
        {m.incidents && (
          <StatCard
            label={t('dashboard.openIncidents')}
            value={m.incidents.open}
            accent={tokens.red}
            icon={<ReportProblemIcon />}
          />
        )}
        {m.gis && (
          <StatCard
            label={t('dashboard.sites')}
            value={m.gis.total}
            accent={tokens.cyan}
            icon={<PlaceIcon />}
          />
        )}
        {m.assets && (
          <StatCard
            label={t('dashboard.assetsReady')}
            value={assetsOperational}
            accent={tokens.goldBright}
            icon={<InventoryIcon />}
          />
        )}
      </Stack>

      {/* Clearance pie + 7-day activity */}
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <SectionCard title={t('dashboard.clearanceDistribution')}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke={tokens.surface} />
                ))}
              </Pie>
              <Legend />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(201,162,39,0.06)' }} />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title={t('dashboard.auditActivity')}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={activityData}>
              <defs>
                <linearGradient id="dashGranted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tokens.green} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={tokens.green} stopOpacity={0.55} />
                </linearGradient>
                <linearGradient id="dashDenied" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tokens.red} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={tokens.red} stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.border} />
              <XAxis dataKey="day" stroke={tokens.muted} fontSize={12} tickLine={false} />
              <YAxis stroke={tokens.muted} fontSize={12} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(201,162,39,0.06)' }} />
              <Legend />
              <Bar
                dataKey="granted"
                stackId="a"
                fill="url(#dashGranted)"
                name={t('dashboard.granted')}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="denied"
                stackId="a"
                fill="url(#dashDenied)"
                name={t('dashboard.denied')}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </Stack>

      {/* Recent audit feed */}
      {data.recent_audit && (
        <SectionCard
          title={t('dashboard.recentAudit')}
          action={<SecurityIcon sx={{ color: tokens.gold, fontSize: 18, opacity: 0.7 }} />}
        >
          <Stack spacing={0.5}>
            {data.recent_audit.map((row, i) => (
              <Stack
                key={i}
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{
                  fontSize: 13,
                  color: tokens.muted,
                  px: 1,
                  py: 1,
                  borderRadius: 1,
                  transition: 'background 0.15s',
                  '&:hover': { background: tokens.surface2 },
                }}
              >
                <Box component="span" sx={{ width: 64, fontFamily: 'monospace' }}>
                  {row.ts.slice(11, 19)}
                </Box>
                <Box component="span" sx={{ width: 90, color: tokens.text, fontWeight: 600 }}>
                  {row.actor_label}
                </Box>
                <Box component="span" sx={{ flex: 1 }}>
                  {row.action} {row.target_type ? `· ${row.target_type}` : ''}
                </Box>
                <Chip
                  label={row.result}
                  size="small"
                  color={row.result === 'DENIED' ? 'error' : 'success'}
                  variant="outlined"
                />
              </Stack>
            ))}
          </Stack>
        </SectionCard>
      )}
    </Stack>
  )
}
