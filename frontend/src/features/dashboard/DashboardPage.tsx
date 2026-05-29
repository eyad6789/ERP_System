import BlockIcon from '@mui/icons-material/Block'
import GroupIcon from '@mui/icons-material/Group'
import HistoryIcon from '@mui/icons-material/History'
import SecurityIcon from '@mui/icons-material/Security'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
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

import { fetchDashboard } from '../../api/dashboard'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { classification, tokens } from '../../theme/tokens'

const tooltipStyle = {
  background: tokens.surface2,
  border: `1px solid ${tokens.border}`,
  borderRadius: 8,
  color: tokens.text,
} as const

export function DashboardPage() {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
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
      <Typography variant="h5">{t('nav.dashboard')}</Typography>

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <StatCard
          label={t('dashboard.totalUsers')}
          value={data.kpis.total_users}
          accent={tokens.cyan}
          icon={<GroupIcon />}
        />
        <StatCard
          label={t('dashboard.totalRoles')}
          value={data.kpis.total_roles}
          accent={tokens.gold}
          icon={<VpnKeyIcon />}
        />
        <StatCard
          label={t('dashboard.events7d')}
          value={data.kpis.audit_events_7d}
          accent={tokens.green}
          icon={<HistoryIcon />}
        />
        <StatCard
          label={t('dashboard.denied7d')}
          value={data.kpis.denied_7d}
          accent={tokens.red}
          icon={<BlockIcon />}
        />
      </Stack>

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
