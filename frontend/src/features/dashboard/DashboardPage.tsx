import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material'
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
import { classification, tokens } from '../../theme/tokens'

function Kpi({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card sx={{ minWidth: 180, flex: 1 }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" sx={{ color: accent ?? tokens.text, fontWeight: 700 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card sx={{ flex: 1, minWidth: 320 }}>
      <CardContent>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  )
}

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
        <Kpi label={t('dashboard.totalUsers')} value={data.kpis.total_users} accent={tokens.cyan} />
        <Kpi label={t('dashboard.totalRoles')} value={data.kpis.total_roles} accent={tokens.gold} />
        <Kpi label={t('dashboard.events7d')} value={data.kpis.audit_events_7d} accent={tokens.green} />
        <Kpi label={t('dashboard.denied7d')} value={data.kpis.denied_7d} accent={tokens.red} />
      </Stack>

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <Panel title={t('dashboard.clearanceDistribution')}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title={t('dashboard.auditActivity')}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.border} />
              <XAxis dataKey="day" stroke={tokens.muted} fontSize={12} />
              <YAxis stroke={tokens.muted} fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="granted" stackId="a" fill={tokens.green} name={t('dashboard.granted')} />
              <Bar dataKey="denied" stackId="a" fill={tokens.red} name={t('dashboard.denied')} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </Stack>

      {data.recent_audit && (
        <Panel title={t('dashboard.recentAudit')}>
          <Stack spacing={1}>
            {data.recent_audit.map((row, i) => (
              <Stack
                key={i}
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ fontSize: 13, color: tokens.muted }}
              >
                <Box component="span" sx={{ width: 64, fontFamily: 'monospace' }}>
                  {row.ts.slice(11, 19)}
                </Box>
                <Box component="span" sx={{ width: 90, color: tokens.text }}>
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
        </Panel>
      )}
    </Stack>
  )
}
